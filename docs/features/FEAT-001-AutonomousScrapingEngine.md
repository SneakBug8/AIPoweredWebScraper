# FEAT-001 — Autonomous Scraping Engine

| FEAT | Title | Service | Status | Priority | Traceability (US) |
|------|-------|---------|--------|----------|--------------|
| FEAT-001 | Autonomous scraping engine | ScraperService | done | must | US1, US2, US3, US4, US5, US40 |

## 1. Overview

The scraping engine crawls websites autonomously. It discovers page links, saves the page HTML, converts the HTML to Markdown, and stores every step in the database. The stored state makes the crawl resumable after a restart.

## 2. Business Requirements (BABOK)

- BR-1: The engine must crawl a source without manual page-by-page control.
- BR-2: The engine must resume an interrupted crawl with almost no lost work.
- BR-3: The engine must avoid re-visiting the same page within the retention period.
- BR-4: The engine must save only the meaningful content of each page.

## 3. Scope

### In Scope

- Autonomous crawling with a link queue stored in the database.
- Link filtering by category URL.
- HTML saving to the filesystem.
- Markdown conversion with Turndown.
- Clutter removal with per-source selectors.
- Retry logic for flaky page loads.
- One-source-at-a-time busy locking.

### Out of Scope

- Structured field extraction (see FEAT-002, FEAT-003, FEAT-004, FEAT-005).
- Web dashboards and their routes.

## 4. User Stories and Acceptance Criteria

| Story ID | User Story |
|----------|------------|
| US1 | User initiates scraping with a command. |
| US1AC3 | Scraping is done async to bot operations. |
| US2 | The scraper does scraping autonomously. |
| US2AC1 | The scraper maintains a list of already scraped URLs in the DB. |
| US2AC2 | The scraper maintains a queue of URLs to scrape in the DB. |
| US2AC3 | The scraper stores all state in the DB and is fully resumable. |
| US2AC4 | If a URL is already scraped, the scraper ignores it. |
| US2AC5 | The scraper waits for the page to load and applies artificial delay. |
| US2AC7 | The scraper adds `a[href]` links on the page to the queue. |
| US2AC8 | The scraper continues scraping until the queue is empty. |
| US2AC9 | The scraper shuffles the queue to cover more pages. |
| US2AC10 | The scraper repeats tries to open the page until it succeeds. |
| US2AC11 | The scraper maintains metadata records in the DB for URLs and files. |
| US2AC12 | The scraper visits only pages without an HTML file or visited long ago. |
| US2AC13 | When a page returns 404, the engine skips it and deletes its record. |
| US2AC14 | The scraper scrolls the page down to trigger infinite loading. |
| US2AC15 | The scraper does not process one source more than once at a time. |
| US3 | The scraper filters links it finds to narrow down the search. |
| US3AC1 | The scraper follows a link only if it matches the category URL or the initial URL. |
| US4 | The scraper saves the HTML and converts it to Markdown. |
| US4AC1 | The scraper saves only the meaningful part of the page. |
| US4AC1 | The `/convert_to_md` command converts all fetched HTML files. |
| US4AC2 | Conversion is done async to the main bot flow. |
| US4AC9 | The scraper saves only pages matching the category URL. |
| US4AC10 | The scraper tries to find the most precise root element of the page. |
| US5 | The scraper removes unwanted elements from the page. |
| US40 | The scraper retries opening a page until it succeeds. |
| US40AC20 | The scraper tries to open the page 5 times before returning the error. |

## 5. Functional Requirements

| Req ID | Requirement | Trace |
|--------|-------------|-------|
| FR-1 | Pop the next URL from the shuffled queue and open it. | US2, US2AC8, US2AC9 |
| FR-2 | Store visited URLs, with a 30-day re-visit window. | US2AC1, US2AC4, US2AC12 |
| FR-3 | Collect links that match the source pattern and insert them into the queue. | US3, US3AC1, US2AC7 |
| FR-4 | Save the cleaned root element HTML to `data/<source>/`. | US4, US4AC1, US4AC9, US4AC10 |
| FR-5 | Delete records of pages that return HTTP 404. | US2AC13 |
| FR-6 | Scroll the page to load paginated content. | US2AC14 |
| FR-7 | Convert the saved HTML to Markdown and store the path. | US4AC1, US4AC2 |
| FR-8 | Lock each source to a single concurrent crawl. | US2AC15 |
| FR-9 | Retry each page load until it succeeds. | US2AC10, US40, US40AC20 |

## 6. Interfaces

### Commands

| Command | Action |
|---------|--------|
| `/scrape_kentavar` | Start crawling the Kentavar source. |
| `/scrape_autobg` | Start crawling the AutoBG source. |
| `/scrape_knowledge` | Start crawling the knowledge source. |
| `/scrape_mckinsey` | Start crawling the McKinsey source. |
| `/scrape_beeline` | Start crawling the job source. |
| `/convert_to_md` | Convert all queued HTML files to Markdown. |
| `/status` | Report the state of every queue. |

### Web Routes

| Route | Method | Action |
|-------|--------|--------|
| Any dashboard scrape button | POST | Starts the crawl in the background. |
| Any dashboard convert button | POST | Starts Markdown conversion. |

## 7. Data Model

Entity: `ScrapedPageRecord`, table `ScrapedPageRecords` in `data/db.db`.

| Field | Type | Meaning |
|-------|------|---------|
| `URL` | text | The absolute page URL. |
| `htmlfilepath` | text/null | Path of the saved HTML file; null means not yet saved. |
| `mdfilepath` | text/null | Path of the converted Markdown file; null means not yet converted. |
| `LAST_FETCHED` | integer | Millisecond timestamp of the last successful fetch. |

Derived queues:

- Scraping queue: `htmlfilepath IS NULL` and `LAST_FETCHED` older than 30 days.
- Recently scraped: `htmlfilepath NOT NULL` and `LAST_FETCHED` newer than 30 days.
- Markdown queue: `htmlfilepath NOT NULL` and `mdfilepath IS NULL`.
- Field extraction queue: `mdfilepath NOT NULL`.

## 8. Implementation Notes

- Core code: `src/scraper/ScraperService.ts`, `src/scraper/ScrapedPage.ts`.
- Source configuration: `src/scraper/ScrapeSource.ts` defines `folderName`, `initialUrl`, `categoryUrl`, root selectors, and clutter selectors per site.
- Browsing uses Playwright with Firefox. The engine applies random delays of 1 to 16 seconds between pages.
- The queue is shuffled on each cycle to spread coverage across the site tree.

## 9. Risks and Open Items

- The 30-day re-visit window may miss listings that change faster than the interval.
- An infinite-loading page can loop forever if its height never stabilizes.
- Random delays do not adapt to the real rate limits of each source.

## 10. Verification

1. Run `/scrape_kentavar`. Confirm pages appear under `data/kentavar/`.
2. Stop the bot during a crawl and restart it. Confirm the crawl resumes and the queue persists.
3. Run `/convert_to_md`. Confirm Markdown files appear under `data/md/`.
4. Confirm the dashboard queue badges reflect the same counts as `/status`.