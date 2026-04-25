import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { chromium, type BrowserContext, type Locator, type Page } from 'playwright';
import { writeCsv } from './output.js';
import {
  calculateMetrics,
  normalizeWhitespace,
  parseDeletedReviews,
  parseReviewCount,
  parseStarRating,
} from './parsers.js';
import {
  loadOrCreateState,
  markVenueCompleted,
  markVenueFailed,
  saveState,
  upsertDiscoveredVenue,
} from './state.js';
import type { ScrapedVenue, ScraperConfig, ScraperState, Venue } from './types.js';

export async function runScraper(config: ScraperConfig): Promise<void> {
  const state = await loadOrCreateState(config.statePath);
  const rows = await loadExistingRows(config.outputCsvPath);
  const context = await chromium.launchPersistentContext(config.browserProfileDir, {
    headless: !config.headed,
    locale: config.locale,
    viewport: { width: 1440, height: 1100 },
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    page.setDefaultTimeout(config.navigationTimeoutMs);
    page.setDefaultNavigationTimeout(config.navigationTimeoutMs);

    await discoverVenues(page, config, state);
    await scrapeVenues(page, config, state, rows);
  } finally {
    await context.close();
  }
}

async function discoverVenues(
  page: Page,
  config: ScraperConfig,
  state: ScraperState,
): Promise<void> {
  if (state.discoveredVenues.length >= config.depth) {
    return;
  }

  const searchUrl = `${config.googleMapsUrl}/search/${encodeURIComponent(
    `${config.searchTerm} ${config.city} ${config.country}`,
  )}`;

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await maybeAcceptConsent(page);
  await handleBlocker(page, config, state);
  await waitForFirstSearchResult(page);

  let unchangedScrolls = 0;
  for (let scrolls = 0; scrolls < config.maxResultScrolls; scrolls += 1) {
    const before = state.discoveredVenues.length;
    const venues = await extractVisibleSearchResults(page);
    for (const venue of venues) {
      upsertDiscoveredVenue(state, venue);
      if (state.discoveredVenues.length >= config.depth) {
        break;
      }
    }

    await saveState(config.statePath, state);
    if (state.discoveredVenues.length >= config.depth) {
      return;
    }

    unchangedScrolls = state.discoveredVenues.length === before ? unchangedScrolls + 1 : 0;
    if (unchangedScrolls >= 4) {
      return;
    }

    await scrollResultsPanel(page);
    await page.waitForTimeout(config.resultScrollDelayMs);
  }
}

async function scrapeVenues(
  page: Page,
  config: ScraperConfig,
  state: ScraperState,
  rows: ScrapedVenue[],
): Promise<void> {
  const alreadyOutput = new Set(rows.map((row) => row.url));

  for (let index = state.cursor; index < state.discoveredVenues.length; index += 1) {
    const venue = state.discoveredVenues[index];
    if (!venue || state.completedUrls.includes(venue.url)) {
      continue;
    }

    try {
      await page.goto(venue.url, { waitUntil: 'domcontentloaded' });
      await maybeAcceptConsent(page);
      await handleBlocker(page, config, state);
      await waitForVenueShell(page, venue);

      const scraped = await scrapeVenue(page, venue, config.searchTerm);
      upsertScrapedRow(rows, scraped);
      alreadyOutput.add(scraped.url);

      markVenueCompleted(state, venue.url);
      await saveState(config.statePath, state);
      await writeCsv(config.outputCsvPath, rows);
    } catch (error) {
      markVenueFailed(state, venue.url);
      await saveState(config.statePath, state);

      const message = error instanceof Error ? error.message : String(error);
      upsertScrapedRow(rows, toFailedRow(venue, message, config.searchTerm));
      alreadyOutput.add(venue.url);
      await writeCsv(config.outputCsvPath, rows);

      if (config.resumeMode === 'stop') {
        throw new Error(
          `Stopped after failure at ${venue.name}. State saved to ${config.statePath}. Cause: ${message}`,
        );
      }

      await promptManualResume(
        `Could not scrape "${venue.name}". Resolve the issue in the browser if possible, then press Enter to continue.`,
      );
    }
  }
}

export function upsertScrapedRow(rows: ScrapedVenue[], row: ScrapedVenue): void {
  const index = rows.findIndex((candidate) => candidate.url === row.url);
  if (index === -1) {
    rows.push(row);
    return;
  }

  rows[index] = row;
}

async function scrapeVenue(
  page: Page,
  venue: Venue,
  venueType: string,
): Promise<ScrapedVenue> {
  let overviewText = await getExtractionText(page);
  if (parseStarRating(overviewText) === null && parseReviewCount(overviewText) === null) {
    await page.waitForTimeout(700);
    overviewText = await getExtractionText(page);
  }

  const overviewRating = parseStarRating(overviewText);
  const overviewReviewCount = parseReviewCount(overviewText);

  const openedReviews = await openReviewsTab(page);
  if (openedReviews) {
    await waitForReviewsPanel(page);
  }

  let pageText = openedReviews ? await getExtractionText(page) : overviewText;
  if (openedReviews && parseReviewCount(pageText) === null) {
    await page.waitForTimeout(700);
    pageText = await getExtractionText(page);
  }

  const deleted = parseDeletedReviews(pageText);
  const totalReviews = parseReviewCount(pageText) ?? overviewReviewCount;
  const rating = overviewRating ?? parseStarRating(pageText);
  const metrics = calculateMetrics({
    rating,
    visibleReviews: totalReviews,
    deletedReviewsEstimate: deleted?.estimate ?? 0,
  });

  const status: ScrapedVenue['status'] =
    totalReviews === null || rating === null ? 'partial' : 'ok';

  return {
    ...venue,
    venueType,
    totalReviews,
    deletedReviewsMin: deleted?.min ?? 0,
    deletedReviewsMax: deleted?.max ?? 0,
    deletedReviewsEstimate: deleted?.estimate ?? 0,
    currentStarRating: rating,
    percentageDeleted: metrics.percentageDeleted,
    realScoreIfDeletedAreOneStar: metrics.realScoreIfDeletedAreOneStar,
    deletedReviewNotice: deleted?.rawText ?? null,
    scrapedAt: new Date().toISOString(),
    status,
  };
}

async function waitForFirstSearchResult(page: Page): Promise<void> {
  await page
    .locator('a[href*="/maps/place"], a[href*="google."][href*="/maps/place"]')
    .first()
    .waitFor({ state: 'attached', timeout: 10_000 })
    .catch(() => undefined);
}

async function waitForVenueShell(page: Page, venue: Venue): Promise<void> {
  await page
    .waitForFunction(
      (name) => document.body.innerText.includes(name) && /[1-5],[0-9]|Rezension/.test(document.body.innerText),
      venue.name,
      { timeout: 1_300 },
    )
    .catch(() => undefined);
}

async function waitForReviewsPanel(page: Page): Promise<void> {
  await page
    .getByText(/Bewertungen aufgrund von Beschwerden wegen Diffamierung entfernt|Rezensionen|Sortieren/i)
    .first()
    .waitFor({ state: 'attached', timeout: 1_300 })
    .catch(() => undefined);
}

async function getExtractionText(page: Page): Promise<string> {
  const bodyText = await page.locator('body').innerText();
  const ariaLabels = await page.locator('[aria-label]').evaluateAll((elements) =>
    elements
      .map((element) => element.getAttribute('aria-label'))
      .filter((label): label is string => Boolean(label)),
  );

  return combineExtractionText(bodyText, ariaLabels);
}

export function combineExtractionText(bodyText: string, ariaLabels: string[]): string {
  const fragments = [bodyText, ...ariaLabels]
    .map((fragment) => normalizeWhitespace(fragment))
    .filter(Boolean);

  return [...new Set(fragments)].join(' ');
}

async function extractVisibleSearchResults(page: Page): Promise<Venue[]> {
  const anchors = page.locator('a[href*="/maps/place"], a[href*="google."][href*="/maps/place"]');
  const count = await anchors.count();
  const venues: Venue[] = [];

  for (let index = 0; index < count; index += 1) {
    const anchor = anchors.nth(index);
    const href = await anchor.getAttribute('href');
    const name = await extractVenueName(anchor);
    if (!href || !name || isUtilityMapsLink(name)) {
      continue;
    }

    venues.push({
      name,
      url: href,
    });
  }

  return venues;
}

async function extractVenueName(anchor: Locator): Promise<string | null> {
  const aria = await anchor.getAttribute('aria-label');
  if (aria) {
    return normalizeWhitespace(aria);
  }

  const text = normalizeWhitespace(await anchor.innerText().catch(() => ''));
  return text.length > 0 ? text.split('\n')[0] ?? text : null;
}

async function openReviewsTab(page: Page): Promise<boolean> {
  const tab = page.getByRole('tab', { name: /Rezensionen|Bewertungen|Reviews/i }).first();
  if ((await tab.count()) > 0) {
    await tab.click();
    return true;
  }

  const button = page.getByRole('button', { name: /Rezensionen|Bewertungen|Reviews/i }).first();
  if ((await button.count()) > 0) {
    await button.click();
    return true;
  }

  const textFallback = page.getByText(/Rezensionen|Bewertungen|Reviews/i).first();
  if ((await textFallback.count()) > 0) {
    await textFallback.click();
    return true;
  }

  return false;
}

async function scrollResultsPanel(page: Page): Promise<void> {
  const feed = page.getByRole('feed').first();
  if ((await feed.count()) > 0) {
    await feed.evaluate((element) => {
      element.scrollBy({ top: element.scrollHeight, behavior: 'instant' });
    });
    return;
  }

  await page.mouse.wheel(0, 2_500);
}

async function maybeAcceptConsent(page: Page): Promise<void> {
  const consentButtons = [
    page.getByRole('button', { name: /Alle akzeptieren|Akzeptieren|Accept all|I agree/i }).first(),
    page.locator('button:has-text("Alle akzeptieren")').first(),
  ];

  for (const button of consentButtons) {
    if ((await button.count()) > 0 && (await button.isVisible().catch(() => false))) {
      await button.click();
      await page.waitForTimeout(250);
      return;
    }
  }
}

async function handleBlocker(
  page: Page,
  config: ScraperConfig,
  state: ScraperState,
): Promise<void> {
  const blocker = await detectBlocker(page);
  if (!blocker) {
    return;
  }

  await saveState(config.statePath, state);
  if (config.resumeMode === 'stop') {
    throw new Error(`${blocker}. State saved to ${config.statePath}.`);
  }

  await promptManualResume(`${blocker}. Resolve it in the browser, then press Enter to continue.`);
}

async function detectBlocker(page: Page): Promise<string | null> {
  const text = normalizeWhitespace(await page.locator('body').innerText().catch(() => ''));
  return detectBlockerText(text);
}

export function detectBlockerText(text: string): string | null {
  if (/ungewöhnlichen traffic|unusual traffic|captcha|ich bin kein roboter/i.test(text)) {
    return 'Google appears to be throttling or challenging the session';
  }
  if (
    /accounts\.google\.com|myaccount\.google\.com/i.test(text) ||
    (/Anmelden|Sign in/i.test(text) && /Passwort|password|E-Mail|email/i.test(text))
  ) {
    return 'Google is asking for sign-in or manual account interaction';
  }

  return null;
}

async function promptManualResume(message: string): Promise<void> {
  const readline = createInterface({ input, output });
  try {
    await readline.question(`${message}\n`);
  } finally {
    readline.close();
  }
}

async function randomDelay(config: ScraperConfig): Promise<void> {
  if (config.actionDelay.maxMs === 0) {
    return;
  }

  const spread = config.actionDelay.maxMs - config.actionDelay.minMs;
  const delay = config.actionDelay.minMs + Math.floor(Math.random() * (spread + 1));
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function loadExistingRows(outputCsvPath: string): Promise<ScrapedVenue[]> {
  try {
    const raw = await readFile(outputCsvPath, 'utf8');
    const [, ...lines] = raw.trim().split('\n');
    const headers = raw.trim().split('\n')[0]?.split(',') ?? [];
    const usesPercentValue = headers[0] === 'venue_type';

    return lines.filter(Boolean).map((line) => {
      const cells = parseCsvLine(line);
      const cell = (header: string): string | undefined => {
        const index = headers.indexOf(header);
        return index >= 0 ? cells[index] : undefined;
      };
      const percentageDeleted = parseNullableNumber(cell('percentage_deleted') ?? cells[8]);

      return {
        venueType: cell('venue_type') ?? '',
        name: cell('name') ?? cells[0] ?? '',
        address: cell('address') || cells[1] || undefined,
        url: cell('url') ?? cells[2] ?? '',
        totalReviews: parseNullableNumber(cell('total_reviews') ?? cells[3]),
        deletedReviewsMin: Number(cell('deleted_reviews_min') ?? cells[4] ?? 0),
        deletedReviewsMax: Number(cell('deleted_reviews_max') ?? cells[5] ?? 0),
        deletedReviewsEstimate: Number(cell('deleted_reviews_estimate') ?? cells[6] ?? 0),
        currentStarRating: parseNullableNumber(cell('current_star_rating') ?? cells[7]),
        percentageDeleted:
          percentageDeleted === null
            ? null
            : usesPercentValue
              ? percentageDeleted / 100
              : percentageDeleted,
        realScoreIfDeletedAreOneStar: parseNullableNumber(
          cell('real_score') ?? cell('real_score_if_deleted_are_1star') ?? cells[9],
        ),
        deletedReviewNotice:
          (cell('review_notice') ?? cell('deleted_review_notice') ?? cells[10]) || null,
        status: ((cell('status') ?? cells[11]) as ScrapedVenue['status']) || 'partial',
        error: (cell('error') ?? cells[12]) || undefined,
        scrapedAt: cell('scraped_at') ?? cells[13] ?? new Date().toISOString(),
      };
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(cell);
      cell = '';
      continue;
    }

    cell += char;
  }

  cells.push(cell);
  return cells;
}

function parseNullableNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isUtilityMapsLink(name: string): boolean {
  return /Route|Speichern|Teilen|Website|Anrufen|Directions|Save|Share|Call/i.test(name);
}

function toFailedRow(venue: Venue, error: string, venueType: string): ScrapedVenue {
  return {
    ...venue,
    venueType,
    totalReviews: null,
    deletedReviewsMin: 0,
    deletedReviewsMax: 0,
    deletedReviewsEstimate: 0,
    currentStarRating: null,
    percentageDeleted: null,
    realScoreIfDeletedAreOneStar: null,
    deletedReviewNotice: null,
    scrapedAt: new Date().toISOString(),
    status: 'failed',
    error,
  };
}
