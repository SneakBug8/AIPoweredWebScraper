# FEAT-005 — McKinsey Industry Fact Extraction

| FEAT | Title | Service | Status | Priority | Traceability (US) |
|------|-------|---------|--------|----------|--------------|
| FEAT-005 | McKinsey industry fact extraction | McKinseyScrapingService | done | should | US9 |

## 1. Overview

The service scrapes McKinsey Insights pages and extracts numerical reference data facts with an LLM. Each figure in an article becomes one structured fact record with its topic, metric, value, region, qualifier, and date.

## 2. Business Requirements (BABOK)

- BR-1: The service must extract every concrete figure from a McKinsey Insights page.
- BR-2: The service must preserve the original number, scale word, and unit unchanged.
- BR-3: The service must never compute, convert, round, or infer a value.
- BR-4: The service must store each fact with its geographic region and precision qualifier.
- BR-5: The service must not store facts from a source URL that is already processed.

## 3. Scope

### In Scope

- McKinsey Insights scraping for the `mckinsey.com/insights` source.
- LLM fact extraction with a strict JSON schema.
- Region and qualifier fields on every fact.
- Deduplication per source URL.
- Dashboard at `/knowledge/mckinsey`.

### Out of Scope

- The IIBA article workflow (see FEAT-004), which has its own commands and dashboard.
- The scraping engine internals (see FEAT-001).

## 4. User Stories and Acceptance Criteria

| Story ID | User Story |
|----------|------------|
| US9 | The scraper extracts numerical reference data facts from McKinsey Insights pages and stores them as IndustryFacts. |
| US9AC1 | The scraper keeps only pages of the relevant content type. |
| US9AC2 | The scraper skips pages whose facts are already stored from the same source. |
| US9AC3 | The scraper inserts new facts it finds in the DB. |
| US9AC4 | Fact extraction is done async to the main bot flow. |
| US9AC5 | The extraction prompt requires an explicit figure and preserves the original value, unit, region, qualifier, and date. |
| US9AC6 | The web dashboard lists the extracted facts with region and qualifier. |
| US9AC7 | The IndustryFacts table persists the region and qualifier columns. |

## 5. Functional Requirements

| Req ID | Requirement | Trace |
|--------|-------------|-------|
| FR-1 | Keep a page only if it looks like a report, article, blog post, or case study. | US9AC1 |
| FR-2 | Skip not-found pages. | US9 |
| FR-3 | Skip pages that already have stored facts for the same URL. | US9AC2 |
| FR-4 | Extract facts with a strict JSON schema (topic, metric, value, region, qualifier, fact, date). | US9, US9AC5 |
| FR-5 | Apply the prompt rules that forbid inferred or converted values. | US9AC5 |
| FR-6 | Insert every fact object from the model output. | US9AC3 |
| FR-7 | Store the source URL on every fact. | US9AC3 |
| FR-8 | Persist the region and qualifier columns in the table. | US9AC7 |
| FR-9 | Render the facts with their region and qualifier on the dashboard. | US9AC6 |
| FR-10 | Run extraction without blocking the bot. | US9AC4 |

## 6. Interfaces

### Commands

| Command | Action |
|---------|--------|
| `/scrape_mckinsey` | Start crawling the McKinsey Insights source. |
| `/extract_mckinsey` | Start industry facts extraction. |

### Web Routes

| Route | Method | Action |
|-------|--------|--------|
| `/knowledge/mckinsey` | GET | Renders the dashboard. |
| `/knowledge/mckinsey/scrape` | POST | Starts crawling. |
| `/knowledge/mckinsey/convert` | POST | Starts Markdown conversion. |
| `/knowledge/mckinsey/extract` | POST | Starts fact extraction. |

## 7. Data Model

Entity: `IndustryFact`, table `IndustryFacts` in `data/knowledge.db`.

| Field | Type | Meaning |
|-------|------|---------|
| `topic` | text | The industry or subject domain. |
| `metric` | text | The quantity that the figure measures. |
| `value` | text | The exact figure with its unit and scale word. |
| `region` | text | The geographic scope of the figure. |
| `qualifier` | text | The precision word, or empty. |
| `fact` | text | A complete sentence that states the figure and its context. |
| `date` | text | The year or date that the figure refers to. |
| `source` | text | The URL of the article. |

## 8. Implementation Notes

- Core code: `src/knowledgescraping/McKinseyScrapingService.ts`, `src/knowledgescraping/IndustryFactRecord.ts`, `src/knowledgescraping/McKinseyScrapingWebService.ts`.
- The system prompt (`IndustryFactsSystemPrompt`) defines the valid figure types and the extraction rules.
- The pre-existing-facts check runs before the LLM call to save tokens.
- The table migration adds `region` and `qualifier` to existing databases without data loss.
- The dashboard is independent from the IIBA article dashboard and follows the same flash-message pattern.

## 9. Risks and Open Items

- The 30-second sleep between extractions limits throughput.
- The dashboard is read-only; editing or deleting facts is not yet possible.
- The source filter depends on the category URL matching; trailing slashes are stripped on both sides before the match.

## 10. Verification

1. Run `/scrape_mckinsey` or press the scrape button on `/knowledge/mckinsey`.
2. Run `/extract_mckinsey` or press the extract button.
3. Confirm `IndustryFacts` receives one row per figure.
4. Re-run the extraction. Confirm already processed URLs add no new facts.
5. Confirm the dashboard shows the `region` and `qualifier` columns.