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
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await randomDelay(config);

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
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await randomDelay(config);

      const scraped = await scrapeVenue(page, venue);
      if (!alreadyOutput.has(scraped.url)) {
        rows.push(scraped);
        alreadyOutput.add(scraped.url);
      }

      markVenueCompleted(state, venue.url);
      await saveState(config.statePath, state);
      await writeCsv(config.outputCsvPath, rows);
      await randomDelay(config);
    } catch (error) {
      markVenueFailed(state, venue.url);
      await saveState(config.statePath, state);

      const message = error instanceof Error ? error.message : String(error);
      if (!alreadyOutput.has(venue.url)) {
        rows.push(toFailedRow(venue, message));
        alreadyOutput.add(venue.url);
        await writeCsv(config.outputCsvPath, rows);
      }

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

async function scrapeVenue(page: Page, venue: Venue): Promise<ScrapedVenue> {
  await openReviewsTab(page);
  await page.waitForTimeout(1_000);

  const pageText = normalizeWhitespace(await page.locator('body').innerText());
  const deleted = parseDeletedReviews(pageText);
  const totalReviews = parseReviewCount(pageText);
  const rating = parseStarRating(pageText);
  const metrics = calculateMetrics({
    rating,
    visibleReviews: totalReviews,
    deletedReviewsEstimate: deleted?.estimate ?? 0,
  });

  const status: ScrapedVenue['status'] =
    totalReviews === null || rating === null ? 'partial' : 'ok';

  return {
    ...venue,
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

async function openReviewsTab(page: Page): Promise<void> {
  const tab = page.getByRole('tab', { name: /Rezensionen|Bewertungen|Reviews/i }).first();
  if ((await tab.count()) > 0) {
    await tab.click();
    return;
  }

  const button = page.getByRole('button', { name: /Rezensionen|Bewertungen|Reviews/i }).first();
  if ((await button.count()) > 0) {
    await button.click();
    return;
  }

  const textFallback = page.getByText(/Rezensionen|Bewertungen|Reviews/i).first();
  if ((await textFallback.count()) > 0) {
    await textFallback.click();
    return;
  }

  throw new Error('Could not find the reviews tab');
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
      await page.waitForTimeout(1_000);
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
  if (/ungewöhnlichen traffic|unusual traffic|captcha|ich bin kein roboter/i.test(text)) {
    return 'Google appears to be throttling or challenging the session';
  }
  if (/Anmelden|Sign in/i.test(text) && /Google Maps/i.test(text) && /Weiter|Next/i.test(text)) {
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
  const spread = config.actionDelay.maxMs - config.actionDelay.minMs;
  const delay = config.actionDelay.minMs + Math.floor(Math.random() * (spread + 1));
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function loadExistingRows(outputCsvPath: string): Promise<ScrapedVenue[]> {
  try {
    const raw = await readFile(outputCsvPath, 'utf8');
    const [, ...lines] = raw.trim().split('\n');
    return lines.filter(Boolean).map((line) => {
      const cells = parseCsvLine(line);
      return {
        name: cells[0] ?? '',
        address: cells[1] || undefined,
        url: cells[2] ?? '',
        totalReviews: parseNullableNumber(cells[3]),
        deletedReviewsMin: Number(cells[4] ?? 0),
        deletedReviewsMax: Number(cells[5] ?? 0),
        deletedReviewsEstimate: Number(cells[6] ?? 0),
        currentStarRating: parseNullableNumber(cells[7]),
        percentageDeleted: parseNullableNumber(cells[8]),
        realScoreIfDeletedAreOneStar: parseNullableNumber(cells[9]),
        deletedReviewNotice: cells[10] || null,
        status: (cells[11] as ScrapedVenue['status']) || 'partial',
        error: cells[12] || undefined,
        scrapedAt: cells[13] ?? new Date().toISOString(),
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

function toFailedRow(venue: Venue, error: string): ScrapedVenue {
  return {
    ...venue,
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
