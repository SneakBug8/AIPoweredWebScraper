# FEAT-004 — Knowledge Article Scraping

| FEAT | Title | Service | Status | Priority | Traceability (US) |
|------|-------|---------|--------|----------|--------------|
| FEAT-004 | Knowledge article scraping | KnowledgeScrapingService | in progress | should | US8 |

## 1. Overview

The service scrapes business-analysis blog pages, extracts article metadata with an LLM, and stores each article once per source URL. When a new article is found, the bot notifies the user with a clickable link.

## 2. Business Requirements (BABOK)

- BR-1: The service must extract the title, author, summary, and publication date.
- BR-2: The service must store each article once and update it on re-crawl.
- BR-3: The service must notify the user about newly discovered articles.
- BR-4: The service must pause extraction after enough new articles are found.

## 3. Scope

### In Scope

- Knowledge article scraping for the IIBA source.
- LLM metadata extraction with a strict JSON schema.
- New-article notification to the default chat.
- Dashboard at `/knowledge`.

### Out of Scope

- The scraping engine internals (see FEAT-001).
- The McKinsey fact workflow (see FEAT-005), which has its own dashboard and commands.

## 4. User Stories and Acceptance Criteria

| Story ID | User Story |
|----------|------------|
| US8 | Scraper scrapes knowledge articles. |
| US8AC1 | The scraper filters out not-found pages. |
| US8AC3 | The scraper inserts new articles it finds in the DB. |
| US8AC4 | The scraper updates articles that come from the same source. |
| US8AC5 | Field extraction is done async to the main bot flow. |
| US8AC6 | After extraction, the scraper clears the Markdown file path. |
| US8AC10 | The scraper adds the shop that the article was found from. |
| US8AC11 | When a new article is found, the scraper notifies the user with a clickable link. |

## 5. Functional Requirements

| Req ID | Requirement | Trace |
|--------|-------------|-------|
| FR-1 | Skip pages that contain "page not found". | US8AC1 |
| FR-2 | Extract title, author, summary, and publication date. | US8 |
| FR-3 | Create or update the article keyed by the source URL. | US8AC3, US8AC4 |
| FR-4 | Store the article shop as `IIBA`. | US8AC10 |
| FR-5 | Clear `mdfilepath` after a successful extraction. | US8AC6 |
| FR-6 | Send a notification when a new article is created. | US8AC11 |
| FR-7 | Stop extraction after 10 new articles. | US8 |

## 6. Interfaces

### Commands

| Command | Action |
|---------|--------|
| `/scrape_knowledge` | Start crawling the knowledge source. |
| `/extract_knowledge` | Start article extraction. |

### Web Routes

| Route | Method | Action |
|-------|--------|--------|
| `/knowledge` | GET | Renders the dashboard. |
| `/knowledge/scrape` | POST | Starts crawling. |
| `/knowledge/extract` | POST | Starts article extraction. |

## 7. Data Model

Entity: `KnowledgeArticle`, table `KnowledgeArticles` in `data/knowledge.db`.

| Field | Type | Meaning |
|-------|------|---------|
| `title` | text | The article title. |
| `author` | text | The article author. |
| `summary` | text | A summary of the article. |
| `contentMd` | text | The article content in Markdown. |
| `published` | text | The publication date. |
| `shop` | text | The source shop identifier. |
| `source` | text | The URL of the article. |

## 8. Implementation Notes

- Core code: `src/knowledgescraping/KnowledgeScrapingService.ts`, `src/knowledgescraping/KnowledgeArticleRecord.ts`.
- The article source list is reused from `ScrapeSource.ts` to keep the scraping logic centralized.
- Extraction stops after 10 new articles to limit cost and time.

## 9. Risks and Open Items

- The IIBA source is blocked by a Cloudflare Turnstile challenge that never resolves. The integration is paused (see `docs/labNote.md`).
- The article sources are currently limited to IIBA.
- The dashboard is read-only; editing article records is not yet possible.

## 10. Verification

1. Run `/scrape_knowledge`. Confirm pages appear in the queue.
2. Run `/extract_knowledge`. Confirm `KnowledgeArticles` receives records.
3. Confirm the `/knowledge` dashboard lists the latest articles.