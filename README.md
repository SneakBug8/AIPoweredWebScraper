# CarPricesAnalysis

CarPricesAnalysis is a stealth scraping system for car, apartment, and job postings. It crawls public sale websites, extracts structured data with AI, and stores everything in a local SQLite database. It operates without manual intervention.

## What the System Does

- Scrapes car sale websites (kentavar.bg, auto.bg).
- Scrapes apartment sale websites (cian.ru).
- Scrapes job vacancy websites (beeline.ru, group.bnpparibas).
- Converts saved pages from HTML to Markdown.
- Extracts structured fields (price, model, year, area, and more) with an AI model.
- Stores all data in local SQLite databases.
- Resumes interrupted work automatically from its saved state.

## Stealth Capabilities

The system is designed to operate quietly and to avoid detection:

- **Isolated browser contexts.** Every request uses a fresh browser context with no leftover cookies. The system leaves no usable session between pages.
- **Randomized delays.** The system waits a random period between requests (1 to 16 seconds by default). This simulates human reading speed.
- **Retry with backoff.** A failed page load is retried up to 5 times with delays between attempts.
- **Targeted link following.** Only links that belong to the target category are followed. Unrelated links are never visited.
- **Clutter removal.** Ads, images, iframes, forms, and navigation menus are removed from the saved page. Only the meaningful article body is stored.
- **Struck-through removal.** Sold or removed items (shown with line-through style) are deleted from the saved content.
- **Infinite scroll handling.** The system loads lazy content by scrolling repeatedly until the page height stops changing.
- **Artificial humanization.** The scraper mixes real browser rendering with DOM manipulation, so saved pages reflect what a human visitor would see.

## Architecture

The system has these main parts:

- `src/scraper/` — the Playwright scraping engine, web source definitions, and the page record repository.
- `src/apartments/` — apartment posting model and the AI field extraction service.
- `src/carpostings/` — car posting model and the AI field extraction service.
- `src/jobpostings/` — job vacancy scraping entry point.
- `src/backup/` — periodic ZIP archive creation and FTP upload.
- `src/api/` — the Telegram and Groq API integrations, and the Express web UI.
- `src/util/` — shared helpers (scheduling, delays, time, and storage).
- `docs/` — detailed documentation for each service.

## Quick Start

1. Install dependencies.

   ```
   npm install
   ```

2. Install the Playwright browser.

   ```
   npx playwright install firefox
   ```

3. Copy the environment template to `.env` and fill in your values.

4. Start the system.

   ```
   npm run
   ```

## Commands

The system accepts commands through Telegram and through the built-in web UI.

- `/scrape_kentavar` — scrape the kentavar.bg car listings.
- `/scrape_autobg` — scrape the auto.bg car listings.
- `/scrape_cian` — scrape the cian.ru apartment listings.
- `/scrape_beeline` — scrape the beeline.ru job vacancies.
- `/convert_to_md` — convert saved HTML pages to Markdown.
- `/extract_cars` — extract structured car data with the AI model.
- `/extract_apartments` — extract structured apartment data with the AI model.
- `/backup force` — create and upload a backup archive immediately.

## Web UI

A password-protected dashboard is available at `http://localhost:PORT/apartments`. The dashboard shows system health and database statistics. It provides buttons for CIAN scraping and apartment field extraction without Telegram.

## Data Storage

- `data/db.db` — main SQLite database for scraped pages and car postings.
- `data/apartments.db` — separate SQLite database for apartment postings.
- `data/<source>/` — saved HTML files for each source.
- `data/md/` — converted Markdown files.
- `backup.zip` — backup archive uploaded to the configured FTP server.