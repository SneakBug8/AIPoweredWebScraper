# CarPostings Module

The CarPostings module extracts structured data from scraped car sale pages using AI. It is the second vertical slice of the stealth scraping system.

## Scope

- Scrapes second-hand car listings on kentavar.bg and auto.bg.
- Converts pages to Markdown for efficient AI processing.
- Extracts car brand, model, production year, mileage, price, and transmission type.
- Stores the postings in the main SQLite database (`data/db.db`, table `CarPostings`).
- Offers command-based control through the Telegram bot.

## Files

- `CarPostingRecord.ts` — the car posting entity and its repository (`CarPostingRecordRepository`).
- `CarPostingService.ts` — the command router and the AI field-extraction pipeline.

## How It Works

1. The stealth engine crawls the car listing websites and saves each page.
2. The Markdown pipeline converts the saved pages.
3. `ExtractAllFields` walks the field-extraction queue.
4. The Groq API extracts structured fields with a strict JSON schema.
5. A `CarPostingRecord` is created or updated (matched by source URL).
6. On API failure the request is retried with a larger, more reliable model.
7. The record leaves the queue after a successful extraction.

## Field Extraction Rules

The extraction pipeline filters pages before asking the AI:

- Only pages that contain a price ("цена") are processed.
- Pages that contain "page not found" are skipped.
- The AI marks each page as a single car page or a listing page.
- Prices below 1002 EUR are rejected as mistakes or parts cars.
- The production year, mileage, and price are normalized to plain numbers.
- The price is always taken in EUR.

## Posting Storage Rules

- A posting is created when no posting exists for the same source URL.
- A posting is updated when one already exists for the same source URL.
- The creation timestamp of the posting matches the page fetch timestamp.

## Commands

The module handles these commands in the Telegram bot:

- `/status` — shows queue sizes and the posting count.
- `/scrape_kentavar` — starts a full crawl of kentavar.bg.
- `/scrape_autobg` — starts a full crawl of auto.bg.
- `/convert_to_md` — converts all saved HTML files to Markdown.
- `/extract_cars` — starts the field-extraction pipeline.