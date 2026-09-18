# JobPostings Module

The JobPostings module scrapes job vacancy listings from career websites. It is a lightweight entry point of the stealth scraping system and reuses the shared scraping engine.

## Scope

- Scrapes job vacancies on job.beeline.ru.
- Provides an additional source for group.bnpparibas career pages.
- Follows only vacancy listings that belong to the configured categories.
- Stores the scraped pages in the shared scraping pipeline (HTML, Markdown, and database records).

## Files

- `JobPostingService.ts` — the command router that starts a full crawl of the Beeline job source.

## How It Works

The module uses the shared stealth engine from `src/scraper/`:

1. `RunFullScraping` is started with the `JobBeelineSource` configuration.
2. The engine crawls the initial vacancy URLs.
3. Links that match the vacancy category URL are added to the queue.
4. Each page is saved, converted to Markdown, and recorded in the database.

## Supported Sources

- `JobBeelineSource` (`jobbeeline` folder) — job.beeline.ru vacancy listings, including remote-work and manager filters.
- `JobBNPParibasSource` (`bnpparibas` folder) — group.bnpparibas career pages, including digital transformation and data roles.

The Beeline source is active. The BNP Paribas source definition is present but its initial URLs are added to the active crawl only after configured conditions.

## Commands

The module handles this command in the Telegram bot:

- `/scrape_beeline` — starts a full crawl of the Beeline job vacancies.

## Roadmap

Extraction of structured job fields is planned but not yet implemented. The next step is to read newly scraped pages, filter them against the user's requirements, and send notifications.