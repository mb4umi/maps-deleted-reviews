# Changelog

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
