# labNote

## 2026-09-18 — Primary UI Migration from Telegram to Browser

### Background
The assistant originally used a Telegram bot as its primary interface. All commands, reports, and status updates went through `node-telegram-bot-api`. The web console (`WebApiService`) existed but acted as a secondary viewer.

The assistant now migrates its primary management UI to the browser. This entry records the reasons for the migration and its current state.

### Reasons for the Migration

#### Telegram Vendor Lock-In
-   The assistant depends on a single external service. Telegram controls the API, its rate limits, and its terms of service. A policy change or an API change can break the assistant without warning.
-   The Telegram Bot API exposes no reliable backup or migration path. If the service becomes unavailable, the user cannot operate the assistant through any other channel.
-   A browser UI uses the standard HTTP stack. The user can host it on any server and access it with any device.

#### Telegram Availability Issues in Certain Countries
-   Telegram is blocked or restricted in several regions. Users in these regions cannot reach the bot or receive its messages reliably.
-   Network-level blocking also affects official clients. The problem is not a configuration issue on the assistant side.
-   A browser UI runs on the user's own host. Access depends only on the user's own network and host availability, not on third-party messaging infrastructure.

#### Poor Presentation of Large Datasets
-   Telegram messages have a maximum length. Large tables and reports must be split or truncated.
-   Telegram does not render tables, sortable columns, or charts. The user must parse plain text lists manually.
-   The browser UI renders full tables with `DataTables` (sorting, pagination, search) and charts with `Chart.js`.

#### Limited Editing Capabilities
-   The Telegram interface supports one-way commands only. The user can start a scrape or search, but cannot inspect, edit, or fix individual records inside the chat flow.
-   Browsing a single record in Telegram requires scrolling through a long message history.
-   The browser UI provides forms, links, and live status badges. It opens the path to full record-level editing in later iterations.

### Migration Target

The browser UI follows the existing `WebApiService` stack:

| Component | Technology |
|---|---|
| Framework | Express.js |
| Templating | EJS (server-side rendering) |
| Auth | Password cookie or query parameter |
| Session | `express-session` + `connect-flash` |
| Presentation | Bootstrap, DataTables, Chart.js |

### Current Dashboards

Each scrape module now exposes a dashboard with:
-   **Actions:** Buttons that start background jobs (scraping, Markdown conversion, field extraction).
-   **System Status:** Live badges (bot availability, source busy, extraction busy).
-   **Database Stats:** Queue sizes and record counts.
-   **Latest Records:** A sortable `DataTables` table of the most recent postings.

| Dashboard | Route | Actions |
|---|---|---|
| Apartments | `GET /apartments` | `POST /apartments/scrape`, `POST /apartments/extract` |
| Knowledge | `GET /knowledge` | `POST /knowledge/scrape`, `POST /knowledge/extract` |
| Cars | `GET /cars` | `POST /cars/scrape_kentavar`, `POST /cars/scrape_autobg`, `POST /cars/convert_to_md`, `POST /cars/extract` |

### The Telegram Bot Remains

The Telegram bot stays functional. It uses the same underlying services as the dashboards. The difference is a matter of priority:

-   The browser UI is the primary operational interface.
-   The Telegram bot becomes an optional notifier and a fallback control channel.

This keeps the project resilient. If Telegram becomes unavailable, the assistant remains fully operable through the browser.

### Open Items

-   Add record-level editing to the dashboards (update and delete forms).
-   Move authentication from a plain-text cookie to a hashed password session.
-   Add charts to each dashboard for price and volume trends.
-   Write a migration runbook that documents the switch-over steps for a fresh deployment.

## 2026-09-18 — IIBA Blog Scraping Integration Abandoned as Too Costly

### Objective

The knowledge scraping module aimed to crawl and extract article postings from the IIBA blog (`https://www.iiba.org/business-analysis-blogs/`). The scraper would save each article page as HTML, convert it to Markdown, and extract structured article fields with an LLM.

### The Anti-Bot Wall

IIBA uses the strictest anti-bot protection encountered in this project. A Cloudflare Turnstile challenge blocks every request:

-   Every article subpage returns HTTP 403 with the "Just a moment..." interstitial.
-   The challenge does not clear automatically. It persists longer than all previous waits.
-   The challenge page does not render a solvable checkbox, so manual interaction cannot pass it.

### Bypass Attempts

The following bypass attempts failed:

-   Playwright bundled Chromium with stealth launch arguments.
-   A real Chrome installation (`channel: "chrome"`).
-   A persistent browser profile.
-   Browser init scripts that spoof automation signals.
-   Automated clicks on the Turnstile widget.
-   A Google Translate proxy (`translate.goog`). The proxy passed the category listing, but every article subpage still returned the 403 challenge.

The scraper integration also introduced a Cloudflare detection helper. The helper waits indefinitely for the challenge to resolve, either automatically or manually. On IIBA, the challenge never resolves.

### Cost-Benefit Analysis

The effort is not worth the result:

-   The bypass cost is high. Evading this protection requires constant maintenance and may still fail after any Cloudflare update.
-   The content value is low. The blog contains opinionated, essay-style posts about business analysis practices. It offers little unique data over other sources.
-   The anti-bot cost does not justify the benefit of opinionated blog posts.

### Decision

The IIBA blog source is not a viable target for automation. The integration must stay paused. Scraping effort goes to sources with reachable content and no anti-bot wall.

### Options for a Replacement Source

-   Use a business analysis blog with no anti-bot protection.
-   Aggregate article links through RSS feeds, which bypass browser blocking.
-   Use a paid scraping service that handles the challenge on a remote host.