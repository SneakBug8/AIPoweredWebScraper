# Feature Traceability Matrix and Tracker

This document tracks every feature and its user stories. It is the single source of truth between features and the `//US[ID]` and `//US[ID]AC[ID]` comments in the source code.

## How to Use This Tracker

1. Create one file per feature in this directory, following `_template.md`.
2. Add the `//US[ID]` comment above the code that implements each user story.
3. Add the `//US[ID]AC[ID]` comment above the code that implements each acceptance criterion.
4. Update the matrices below when you add, change, or complete a feature.

## Status Legend

- `done` — the feature works end to end.
- `in progress` — the implementation is partial.
- `planned` — the feature is designed but not implemented.

## Priority Legend

- `must` — the feature is required for operation.
- `should` — the feature delivers significant value.
- `could` — the feature is optional or experimental.

## Features to User Stories

| FEAT | Title | Service | Status | Priority | Traceability (US) |
|------|-------|---------|--------|----------|--------------|
| [FEAT-001](FEAT-001-AutonomousScrapingEngine.md) | Autonomous scraping engine | ScraperService | done | must | US1, US2, US3, US4, US5, US40 |
| [FEAT-002](FEAT-002-CarPostingsExtraction.md) | Car postings extraction and dashboard | CarPostingService | done | must | US6 |
| [FEAT-003](FEAT-003-ApartmentPostingsExtraction.md) | Apartment postings extraction and dashboard | ApartmentPostingService | done | must | US7 |
| [FEAT-004](FEAT-004-KnowledgeArticleScraping.md) | Knowledge article scraping | KnowledgeScrapingService | in progress | should | US8 |
| [FEAT-005](FEAT-005-McKinseyIndustryFactExtraction.md) | McKinsey industry fact extraction | McKinseyScrapingService | done | should | US9 |
| [FEAT-006](FEAT-006-JobPostingsScraping.md) | Job postings scraping | JobPostingService | in progress | could | US1 |
| [FEAT-007](FEAT-007-ModelRoutingAndTelemetry.md) | Model routing and request telemetry | ModelUseBalancer, ModelRequest | done | must | US14, US23, US100 |

## User Stories to Features

| User Story | Title | Feature |
|------------|-------|---------|
| US1 | User initiates scraping with a command | FEAT-001, FEAT-006 |
| US2 | The scraper does scraping autonomously | FEAT-001 |
| US3 | The scraper filters links it finds to narrow down search | FEAT-001 |
| US4 | The scraper saves HTML and extracts Markdown | FEAT-001 |
| US5 | The scraper removes unwanted elements from the page | FEAT-001 |
| US6 | Scraper uses AI to extract car posting fields | FEAT-002 |
| US7 | Scraper scrapes apartment postings and extracts fields | FEAT-003 |
| US8 | Scraper scrapes knowledge articles | FEAT-004 |
| US9 | Scraper extracts numerical reference data facts from McKinsey Insights | FEAT-005 |
| US14 | Model request telemetry | FEAT-007 |
| US23 | Model routing to the appropriate model | FEAT-007 |
| US40 | The scraper retries opening a page until it succeeds | FEAT-001 |
| US100 | The system supports multiple model API providers | FEAT-007 |