# KnowledgeScraping Module

The KnowledgeScraping module gathers business-analysis articles from a set of scraping sources. It is the knowledge vertical slice of the stealth scraping system.

## Scope

- Scrapes business-analysis blog articles on iiba.org.
- Converts pages to Markdown for efficient storage.
- Extracts article metadata (title, author, summary, publication date) with AI.
- Stores full Markdown text and metadata in a dedicated SQLite database (`data/knowledge.db`).
- Notifies the default Telegram chat when a new article is found.

## Files

- `KnowledgeArticleRecord.ts` — the article entity and its repository (`KnowledgeArticleRepository`).
- `KnowledgeScrapingService.ts` — the command router and the AI metadata-extraction pipeline.

## How It Works

1. The stealth engine crawls the configured knowledge sources and saves each page.
2. The Markdown pipeline converts the saved pages.
3. `ExtractAllArticles` walks the field-extraction queue.
4. The balanced AI router extracts article metadata with a strict JSON schema.
5. A `KnowledgeArticle` is created or updated (matched by source URL).
6. The record leaves the queue after a successful extraction.

## Sources

The module reuses the source definitions from `src/scraper/ScrapeSource.ts`:

- `KnowledgeIIBASource` (`iiba` folder) — business-analysis blog posts on iiba.org.

## Article Storage

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

## Notifications

When a new article is inserted (a URL not seen before), the module sends a message to the default chat. The message carries the article title, the source identifier, and a clickable link to the article.

## Commands

The module handles these commands in the Telegram bot:

- `/scrape_knowledge` — starts a full crawl of the Iiba knowledge source.
- `/extract_knowledge` — starts the article metadata-extraction pipeline.

## Roadmap

- Add more knowledge sources to broaden coverage.
- Add a web dashboard section for the article library.