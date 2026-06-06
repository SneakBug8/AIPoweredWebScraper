# ScraperService

The `ScraperService` is responsible for autonomously crawling car sales websites, extracting content, and using AI to parse structured data.

## Approach
1.  **Automated Browsing:** Uses `selenium-webdriver` with Firefox to navigate complex websites and handle dynamic content.
2.  **Queue Management:** Implements a persistent scraping queue in SQLite. It discovers new links during scraping and adds them to the queue if they match specific source patterns.
3.  **Content Transformation:** Converts saved HTML to Markdown using `turndown`. Markdown is a more token-efficient format for LLM processing.
4.  **AI Extraction:** Utilizes the Groq SDK to send Markdown content to LLMs for structured data extraction (car brand, model, price, etc.) using JSON schema enforcement.

## Subjective Decision-Making
-   **Queue Shuffling:** The scraping queue is shuffled before processing. This is an unproven but intentional strategy to ensure a variety of pages are processed even if the scraper is interrupted, rather than getting stuck in a deep branch of a single site.
-   **Clutter Removal:** The scraper executes custom scripts to remove unwanted DOM elements (selectors defined per source) before saving. This reduces noise and improves LLM accuracy.
-   **Model Fallback:** If the primary Groq model fails, the service automatically switches to a larger, more reliable model. This prioritizes data quality over cost in failure scenarios.
-   **Artificial Delays:** Randomized sleeps (1-16 seconds) are used to mimic human behavior and avoid rate-limiting/blocking.

## Benefits over Market Solutions
-   **Flexible Parsing:** Traditional scrapers rely on brittle CSS selectors that break when a site's layout changes. By using LLMs to "read" the Markdown, this service is highly resilient to UI updates.
-   **End-to-End Automation:** Seamlessly bridges the gap between raw web data and a structured database without manual intervention.
-   **Privacy-First:** Since it runs locally, you don't need to share your scraping patterns or data with SaaS scraping platforms.

## Critiques & Suggestions for Improvement
-   **Critique:** The current implementation of Selenium is resource-heavy, especially when running multiple instances. The manual delay system, while effective, is somewhat arbitrary and doesn't account for actual server load or specific site response times.
-   **Suggestion:** Consider migrating to a lighter-weight scraping library like `playwright` or `puppeteer-core` for better performance. Implement a more dynamic rate-limiting system based on target site response headers (like `Retry-After`) and actual crawling history.
