# FEAT-003 — Apartment Postings Extraction and Dashboard

| FEAT | Title | Service | Status | Priority | Traceability (US) |
|------|-------|---------|--------|----------|--------------|
| FEAT-003 | Apartment postings extraction and dashboard | ApartmentPostingService | done | must | US7 |

## 1. Overview

The service scrapes apartment listings and extracts structured posting fields. The result is stored per source URL and shown in the web dashboard.

## 2. Business Requirements (BABOK)

- BR-1: The service must collect apartment listings without manual input.
- BR-2: The service must store one posting per source URL.
- BR-3: The service must keep the bot responsive while it works.

## 3. Scope

### In Scope

- Apartment scraping and field extraction.
- Price filtering: pages without a price are skipped.
- Dashboard at `/apartments`.

### Out of Scope

- The crawling engine internals (see FEAT-001).

## 4. User Stories and Acceptance Criteria

| Story ID | User Story |
|----------|------------|
| US7 | Scraper scrapes apartment postings and extracts fields. |
| US7AC1 | The scraper filters out pages without the price. |
| US7AC2 | The scraper filters out not-found pages. |
| US7AC3 | The scraper inserts new postings it finds in the DB. |
| US7AC4 | The scraper updates postings that come from the same source. |
| US7AC5 | Field extraction is done async to the main bot flow. |
| US7AC6 | After extraction, the scraper clears the Markdown file path. |
| US7AC10 | The scraper adds the shop that the posting was found from. |

## 5. Functional Requirements

| Req ID | Requirement | Trace |
|--------|-------------|-------|
| FR-1 | Skip pages that contain no price. | US7AC1 |
| FR-2 | Skip not-found pages. | US7AC2 |
| FR-3 | Create or update the posting keyed by the source URL. | US7AC3, US7AC4 |
| FR-4 | Store the shop origin on every record. | US7AC10 |
| FR-5 | Clear `mdfilepath` after a successful extraction. | US7AC6 |
| FR-6 | Run extraction without blocking the bot. | US7AC5 |

## 6. Interfaces

### Commands

| Command | Action |
|---------|--------|
| `/scrape_apartments` | Start crawling the apartment source. |
| `/extract_apartments` | Start field extraction. |

### Web Routes

| Route | Method | Action |
|-------|--------|--------|
| `/apartments` | GET | Renders the dashboard. |
| `/apartments/scrape` | POST | Starts crawling. |
| `/apartments/extract` | POST | Starts field extraction. |

## 7. Data Model

Entity: `ApartmentPosting`, table `ApartmentPostings` in `data/apartments.db`.

| Field | Type | Meaning |
|-------|------|---------|
| `city` | text | The city of the listing. |
| `subwayStation` | text | The nearest subway station. |
| `subwayDistance` | integer | The distance to the station. |
| `transportAvailabiity` | integer | A transport availability score. |
| `year_of_construction` | text | The construction year. |
| `area` | integer | The floor area. |
| `price` | integer | The price. |
| `price_per_meter` | integer | The price per square meter. |
| `type` | text | The apartment type. |
| `shop` | text | The source shop identifier. |
| `source` | text | The URL of the posting. |

## 8. Implementation Notes

- Core code: `src/apartments/ApartmentPostingService.ts`, `src/apartments/ApartmentPostingRecord.ts`.
- The table uses a separate database connection named `apartments`.
- Missing columns, such as `price_per_meter`, are added with a lightweight migration.

## 9. Risks and Open Items

- The field `transportAvailabiity` has a typo in its name.
- The dashboard is read-only; editing records is not yet possible.

## 10. Verification

1. Run the apartment scrape command. Confirm pages appear in the queue.
2. Run the extraction command. Confirm `ApartmentPostings` receives records.
3. Confirm the `/apartments` dashboard lists the latest postings.