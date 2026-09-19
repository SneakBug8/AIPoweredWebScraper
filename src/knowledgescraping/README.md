# KnowledgeScraping Module

The KnowledgeScraping module gathers business-analysis and consulting content from a set of scraping sources. It is the knowledge vertical slice of the stealth scraping system.

The module runs two independent workflows. Each workflow uses a different scraping source, different Telegram commands, and a different web dashboard. The two workflows do not share queues or extraction logic.

| Workflow | Source | Output | Commands | Dashboard |
|---|---|---|---|---|
| Articles | `KnowledgeIIBASource` (`iiba`) | `KnowledgeArticle` | `/scrape_knowledge`, `/extract_knowledge` | `GET /knowledge` |
| Facts | `McKinseyInsightsSource` (`mckinseyinsights`) | `IndustryFact` | `/scrape_mckinsey`, `/extract_mckinsey` | `GET /knowledge/mckinsey` |

## Articles Workflow (IIBA)

- Scrapes business-analysis blog articles on iiba.org.
- Converts pages to Markdown for efficient storage.
- Extracts article metadata (title, author, summary, publication date) with AI.
- Stores full Markdown text and metadata in a dedicated SQLite database (`data/knowledge.db`).
- Notifies the default Telegram chat when a new article is found.

### Article Storage

Each `KnowledgeArticle` stores:

| Field | Description |
|---|---|
| `title` | article title |
| `author` | the author's name |
| `summary` | a short synopsis |
| `contentMd` | the full Markdown text of the article |
| `published` | the publication date as extracted |
| `shop` | source identifier (`IIBA`) |
| `source` | the article URL |

## Facts Workflow (McKinsey)

- Scrapes mckinsey.com insights for numerical reference data.
- Converts pages to Markdown for efficient storage.
- Extracts numerical reference data facts with AI using a strict JSON schema.
- Stores each fact in the `IndustryFacts` table of `data/knowledge.db`.
- Does not notify the chat; facts are reviewed on the dashboard.

### Fact Storage

Each `IndustryFact` stores:

| Field | Description |
|---|---|
| `topic` | the industry or subject domain (Banking, AI adoption, Supply chain...) |
| `metric` | the quantity that is measured (market size, revenue share...) |
| `value` | the exact figure with its unit and scale, as printed |
| `region` | the geographic scope of the figure (Global, United States...) |
| `qualifier` | the precision word attached to the figure (approximately, at least...) |
| `fact` | a complete, self-contained sentence with the figure |
| `date` | the year or the reference date of the figure |
| `source` | the URL of the article the fact came from |

The extraction prompt only saves figures the article states explicitly. Planned and current figures stay distinguishable through the date field.

## Files

- `KnowledgeArticleRecord.ts` — the article entity and its repository (`KnowledgeArticleRepository`).
- `KnowledgeScrapingService.ts` — the article command router and the AI metadata-extraction pipeline.
- `McKinseyScrapingService.ts` — the facts command router and the AI fact-extraction pipeline.
- `McKinseyScrapingWebService.ts` — the McKinsey web dashboard routes.
- `KnowledgeScrapingWebService.ts` — the articles web dashboard routes.
- `IndustryFactRecord.ts` — the fact entity and its repository (`IndustryFactRepository`).

## Sources

The module reuses the source definitions from `src/scraper/ScrapeSource.ts`:

- `KnowledgeIIBASource` (`iiba` folder) — business-analysis blog posts on iiba.org.
- `McKinseyInsightsSource` (`mckinseyinsights` folder) — mckinsey.com insights pages.

## Notifications

When a new article is inserted (a URL not seen before), the module sends a message to the default chat. The message carries the article title, the source identifier, and a clickable link to the article.

## Commands

The module handles these commands in the Telegram bot:

- `/scrape_knowledge` — starts a full crawl of the Iiba knowledge source.
- `/extract_knowledge` — starts the article metadata-extraction pipeline.
- `/scrape_mckinsey` — starts a full crawl of the McKinsey insights source.
- `/extract_mckinsey` — starts the facts-extraction pipeline.

## Web Dashboards

- `GET /knowledge` — IIBA articles dashboard with scrape and extract buttons.
- `POST /knowledge/scrape` — starts the IIBA crawl.
- `POST /knowledge/extract` — starts the article extraction.
- `GET /knowledge/mckinsey` — McKinsey facts dashboard with scrape, convert, and extract buttons.
- `POST /knowledge/mckinsey/scrape` — starts the McKinsey crawl.
- `POST /knowledge/mckinsey/convert` — converts all pending HTML pages to Markdown.
- `POST /knowledge/mckinsey/extract` — starts the facts extraction.