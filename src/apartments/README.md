# Apartments Module

The Apartments module scrapes apartment sale listings and extracts structured posting data with AI. It is a complete vertical slice of the stealth scraping system.

## Scope

- Scrapes studio and apartment listings on cian.ru.
- Filters listings by price, area, and property type.
- Converts pages to Markdown for efficient AI processing.
- Extracts structured fields (rooms, area, floor, price) from each listing.
- Stores extracted postings in a dedicated SQLite database (`data/apartments.db`).
- Provides the web dashboard used to control the whole system.

## Files

- `ApartmentPostingRecord.ts` — the apartment posting entity and its repository (`ApartmentPostingRepository`).
- `ApartmentPostingService.ts` — the AI field-extraction pipeline. It reads the Markdown queue, calls the Groq API with a JSON schema, and upserts postings.
- `ApartmentPostingWebService.ts` — the Express dashboard (`/apartments`) with buttons for CIAN scraping and field extraction, plus system and database statistics.

## How It Works

1. A scraping queue of CIAN listing URLs is crawled by the stealth engine.
2. Each page is converted to Markdown by the Markdown pipeline.
3. `ExtractAllFields` walks the field-extraction queue.
4. The Groq API extracts structured fields with a strict JSON schema.
5. A `ApartmentPostingRecord` is created or updated (matched by source URL).
6. On API failure the request is retried with a larger, more reliable model.
7. After a successful extraction the record leaves the queue.

## Web Dashboard

The dashboard at `/apartments` is the primary control surface. It requires a password from the environment configuration.

- It shows whether the bot, the scraper, and the field extraction are idle or busy.
- It shows queue sizes for each processing stage.
- It shows the latest 20 postings in a table.
- The "Run CIAN scraping" button starts `RunFullScraping` asynchronously.
- The "Extract all fields" button starts `ExtractAllFields` asynchronously.

The actions follow the Post-Redirect-Get pattern. They refuse to start when the same job is already running. Result messages (success or error) are shown with the flash mechanism.

## Field Extraction Rules

The extraction pipeline filters pages before asking the AI:

- Only pages that contain a price ("цена") are processed.
- Pages that contain "page not found" are skipped.
- The AI marks each page as a single apartment page or a listing page.
- Prices below a configured threshold are rejected as errors.