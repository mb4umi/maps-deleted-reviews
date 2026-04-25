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
