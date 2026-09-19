# FEAT-006 — Job Postings Scraping

| FEAT | Title | Service | Status | Priority | Traceability (US) |
|------|-------|---------|--------|----------|--------------|
| FEAT-006 | Job postings scraping | JobPostingService | in progress | could | US1 |

## 1. Overview

The service starts a crawl of the job-posting source. The feature is a partial shell: it can crawl pages into the queue, but the field extraction and user notification steps are not implemented.

## 2. Business Requirements (BABOK)

- BR-1: The service must crawl the job-posting source.
- BR-2: The service must eventually notify the user about relevant new postings.

## 3. Scope

### In Scope

- Crawl of the Beeline job source.

### Out of Scope

- Structured job extraction.
- User notifications.

## 4. User Stories and Acceptance Criteria

| Story ID | User Story |
|----------|------------|
| US1 | The user initiates scraping with a command. |
| US1AC3 | Scraping is done async to bot operations. |

## 5. Functional Requirements

| Req ID | Requirement | Trace |
|--------|-------------|-------|
| FR-1 | Start the crawl of the Beeline source. | US1 |
| FR-2 | Run the crawl without blocking the bot. | US1AC3 |

## 6. Interfaces

### Commands

| Command | Action |
|---------|--------|
| `/scrape_beeline` | Start crawling the job source. |

## 7. Data Model

This feature uses the shared `ScrapedPageRecord` queue from FEAT-001. No job-specific table exists yet.

## 8. Implementation Notes

- Core code: `src/jobpostings/JobPostingService.ts`.
- Source configuration: `JobBeelineSource` in `src/scraper/ScrapeSource.ts`.

## 9. Risks and Open Items

- No extraction pipeline exists for job pages.
- No notification flow exists for relevant jobs.
- The intended behavior is documented in a `TODO` comment in the service.

## 10. Verification

1. Run `/scrape_beeline`. Confirm the crawl starts and pages enter the queue.