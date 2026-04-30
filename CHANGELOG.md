# Changelog

## 0.2.0 - 2026-04-25

- Made scraper output and state files search-specific so changing the venue type starts the correct run.
- Added stale-state detection using city, country, and search term.
- Kept the fast scraping path while adding conditional waits to avoid partial rows.
- Reordered CSV output and changed deleted percentage values to percent format.

## 0.1.0 - 2026-04-25

- Added a config-driven Playwright CLI for scraping Google Maps deleted-review notices.
- Added resumable state handling, pause/stop blocker behavior, and partial CSV output.
- Added parser, scoring, config, state, and CSV tests.
- Added README instructions for installation, configuration, running, and troubleshooting.
- Added annotated config example and city/search-term based default CSV filenames.
- Tightened blocker detection so normal Google Maps sign-in buttons do not stop smoke runs.
- Replaced failed CSV rows when a later resume attempt succeeds.
- Parsed compact Google Maps rating text and cleared stale failed URLs after successful retries.
- Included accessibility labels in extraction text so Google Maps ratings can be parsed when not visible in body text.
- Captured venue ratings before opening the reviews tab to avoid confusing review filter labels with venue ratings.
- Lowered the default Playwright action and result-scroll waits to 1300ms.
- Optimized live scraping for fast connections by removing fixed per-venue waits and using short condition-based waits.
- Allowed venues without a separate reviews tab to be recorded from overview data instead of failing the run.
- Added brief conditional re-reads when venue or reviews data is missing to reduce partial rows without slowing every venue.
- Reordered CSV columns, added venue type, and output deletion percentages as percent values.
- Made default state files search-specific and reset stale state when city/country/search term changes.
- Reconciled resume state with existing CSV rows so stale completed URLs are retried if output is missing.
- Waited for rate-limit pages to finish loading before recording the venue and continuing.
- Improved hotel-result discovery by scrolling the Maps feed directly and waiting for lazy-loaded place links.
- Parsed German number-word deletion ranges such as "Zwei bis fünf Bewertungen".
- Added JSON run summaries and console summary output after each scrape.
- Added CLI overrides for city, country, search terms, depth, resume mode, paths, and headed/headless mode.
- Added batch mode via `searchTerms` or `--search-terms` to run multiple venue types sequentially.
- Bumped package version to 0.3.0.
- Added multi-city CLI batch mode via `--cities`, including city/search-term combinations with separate output, state, and summary files.
- Re-fetch rows at the end of a run when the parsed star rating is above 5 or total reviews are 0.
- Hardened review-count parsing so venue totals such as `4,9 (42.291)` are preferred over reviewer contribution counts like `Local Guide · 56 Rezensionen`.
- Restart completed reruns from Google Maps search discovery instead of restoring the last open venue from the persistent browser profile.
- Retry failed and partial rows at the end of a run and make Reviews-tab opening more patient after transient Google throttling.
- Wait 60 seconds for manual Google captcha resolution before retrying rate-limited venues and print live venue discovery/scrape progress.
- Sort generated CSV rows by percentage deleted, name, and deleted review maximum, with a `sort-csv` script for legacy files.
- Add `merge-csv` and `--merge-csv-path` to combine generated CSV files while deduplicating venues by name.
