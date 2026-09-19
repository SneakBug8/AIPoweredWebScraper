# FEAT-002 — Car Postings Extraction and Dashboard

| FEAT | Title | Service | Status | Priority | Traceability (US) |
|------|-------|---------|--------|----------|--------------|
| FEAT-002 | Car postings extraction and dashboard | CarPostingService | done | must | US6 |

## 1. Overview

The service asks an LLM to read a scraped car page and extract structured fields. The result is stored as one posting record per source URL and shown in the web dashboard.

## 2. Business Requirements (BABOK)

- BR-1: The service must extract the car brand, model, production year, mileage, and price.
- BR-2: The service must store one posting per source URL and update it on re-crawl.
- BR-3: The service must reject pages that are not single-car postings.
- BR-4: The service must stay responsive to the user while extraction runs.

## 3. Scope

### In Scope

- LLM extraction with a strict JSON schema.
- Validation of price and page type.
- Insert and update of posting records.
- Model fallback on failure.
- Dashboard at `/cars`.

### Out of Scope

- The crawling and Markdown conversion steps (see FEAT-001).

## 4. User Stories and Acceptance Criteria

| Story ID | User Story |
|----------|------------|
| US6 | Scraper uses AI to extract key fields from the scraped pages. |
| US6AC1 | Scraper extracts car brand, model, production year, mileage, and price. |
| US6AC2 | Scraper adds the shop that the posting was found from. |
| US6AC3 | The scraper inserts new postings it finds in the DB. |
| US6AC4 | The scraper updates postings that come from the same source. |
| US6AC5 | The scraper switches between two suitable models if an error occurs. |
| US6AC6 | After extraction, the scraper clears the Markdown file path. |
| US6AC1 | Field extraction is done async to the main bot flow. |

## 5. Functional Requirements

| Req ID | Requirement | Trace |
|--------|-------------|-------|
| FR-1 | Read a page only when it contains the word цена and no "page not found" text. | US4AC1 (FEAT-001 reuse) |
| FR-2 | Extract fields with a strict JSON schema enforced model output. | US6, US6AC1 |
| FR-3 | Skip non-car pages and prices below 1002 EUR. | US6 |
| FR-4 | Create or update the posting keyed by the source URL. | US6AC3, US6AC4 |
| FR-5 | Fall back from `openai/gpt-oss-20b` to `openai/gpt-oss-120b` on failure. | US6AC5 |
| FR-6 | Clear `mdfilepath` after a successful extraction. | US6AC6 |

## 6. Interfaces

### Commands

| Command | Action |
|---------|--------|
| `/extract_cars` | Start field extraction for queued car pages. |
| `/scrape_kentavar`, `/scrape_autobg` | Start the crawl of the car sources. |

### Web Routes

| Route | Method | Action |
|-------|--------|--------|
| `/cars` | GET | Renders the dashboard with latest postings. |
| `/cars/scrape_kentavar` | POST | Starts crawling. |
| `/cars/scrape_autobg` | POST | Starts crawling. |
| `/cars/convert_to_md` | POST | Starts Markdown conversion. |
| `/cars/extract` | POST | Starts field extraction. |

## 7. Data Model

Entity: `CarPostingRecord`, table `CarPostings`.

| Field | Type | Meaning |
|-------|------|---------|
| `car_brand` | text | The brand of the car. |
| `model` | text | The model of the car. |
| `year_of_production` | text | The production year. |
| `mileage` | integer | The mileage. |
| `price` | integer | The price in EUR. |
| `is_automatic_transmission_type` | boolean/null | Automatic transmission flag. |
| `shop` | text | The source shop identifier. |
| `source` | text | The URL of the posting. |

## 8. Implementation Notes

- Core code: `src/carpostings/CarPostingService.ts`, `src/carpostings/CarPostingRecord.ts`.
- The service filters the field extraction queue to Kentavar and AutoBG URLs only.
- A 30-second sleep forces a pause between LLM calls.

## 9. Risks and Open Items

- Price below 1002 EUR is hard-coded as a rejection threshold.
- The dashboard is read-only; editing records is not yet possible.

## 10. Verification

1. Run `/extract_cars`. Confirm postings appear in `CarPostings`.
2. Re-run the command. Confirm existing postings update instead of duplicating.
3. Confirm the `/cars` dashboard lists the latest postings.