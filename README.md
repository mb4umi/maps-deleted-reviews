# Google Maps Deleted Reviews Scraper

Config-driven Playwright scraper for collecting Google Maps review deletion notices from venues in a city.

The default configuration searches for restaurants in Bonn, Germany, opens each Google Maps result, visits the reviews tab, and writes a CSV with visible reviews, deleted-review estimates, current rating, deletion percentage, and a theoretical adjusted score.

## Important Notice

This project automates the public Google Maps web UI. Google can change the UI at any time, throttle traffic, require manual account interaction, or block automation. Use low depths, slow delays, and review Google's terms before running this at scale.

## Requirements

- Node.js 20 or newer
- npm
- A desktop environment where headed Chromium can open

## Installation

```bash
npm install
npx playwright install chromium
```

## Configuration

Copy the example config:

```bash
cp config.example.json config.json
```

Edit `config.json`. The example includes an `_annotations` object that explains every setting; it is ignored by the scraper.

```json
{
  "_annotations": {
    "outputCsvPath": "Optional. If omitted, writes output/deleted-reviews-city-searchterm.csv."
  },
  "city": "Bonn",
  "country": "Germany",
  "searchTerm": "restaurant",
  "depth": 50,
  "resumeMode": "pause"
}
```

Common fields:

- `city`: city to search, for example `Bonn`.
- `cities`: optional batch mode array, for example `["Bonn", "Köln"]`.
- `country`: country context, for example `Germany`.
- `searchTerm`: venue type, for example `restaurant`, `Café`, `bar`, or `hotel`.
- `searchTerms`: optional batch mode array, for example `["restaurant", "Cafe", "Hotel"]`.
- `depth`: maximum number of venues to collect from Google Maps search results.
- `resumeMode`: `pause` keeps the browser open when Google blocks or asks for manual action; `stop` saves state and exits.
- `outputCsvPath`: optional CSV output override. If omitted, the default is generated from the config, for example `output/deleted-reviews-bonn-restaurant.csv`.
- `summaryPath`: optional JSON run summary path. If omitted, the default is generated from the config.
- `statePath`: optional resumable checkpoint path. If omitted, the default is generated from the config.
- `actionDelay`: random delay range between browser actions.

## Running

```bash
npm run dev
```

Or with a custom config path:

```bash
npm start -- --config config.json
```

Override config values from the command line:

```bash
npm start -- --city Köln --country Germany --search-term Hotel --depth 100 --headless
```

Run multiple venue types sequentially:

```bash
npm start -- --city Bonn --country Germany --search-terms restaurant,Cafe,Hotel --depth 50
```

Run multiple cities sequentially:

```bash
npm start -- --cities Bonn,Köln,Düsseldorf --country Germany --search-term Hotel --depth 50
```

You can combine `--cities` and `--search-terms`; the scraper runs every city/search-term combination and writes separate CSV, state, and summary files for each.

For a first smoke test, set `depth` to `3`.

## Resume Behavior

Progress is saved after venue discovery and after each completed venue scrape. If the run stops, rerun the same command with the same `statePath` and `outputCsvPath`.

With `resumeMode: "pause"`, the browser stays open if Google shows a blocker. Resolve the issue manually in the browser, then press Enter in the terminal.

With `resumeMode: "stop"`, the process exits cleanly after saving state. Run the command again later to continue.

## CSV Columns

- `venue_type`
- `name`
- `total_reviews`
- `deleted_reviews_min`
- `deleted_reviews_max`
- `percentage_deleted`
- `current_star_rating`
- `real_score`
- `review_notice`
- `url`
- `address`
- `deleted_reviews_estimate`
- `status`
- `error`
- `scraped_at`

The adjusted score assumes every deleted review would have been a one-star review:

```text
((current_star_rating * total_reviews) + deleted_reviews_estimate) / (total_reviews + deleted_reviews_estimate)
```

## Selector Strategy

The scraper avoids Google Maps' obfuscated CSS classes. It uses:

- accessible roles such as tabs, buttons, feeds, and links
- visible German/English text such as `Rezensionen`
- Maps place URLs
- regex parsing for review counts, ratings, and deletion notices

This is still best-effort UI automation. If Google changes the language or page layout, update the parser regexes or the role/text selectors in `src/mapsScraper.ts`.

## Development

```bash
npm test
npm run typecheck
npm run build
```

Source files live in `src/`; parser and CSV behavior is covered by tests in `test/`.

`npm run build` emits the CLI into `dist/`.
