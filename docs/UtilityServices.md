# UtilityServices

The assistant includes several small but critical utility services that handle low-level operations.

## Sleep Utility (`src/util/Sleep.ts`)
A simple promise-based wrapper for `setTimeout`.
- **Approach:** Returns a `Promise` that resolves after a specified number of milliseconds.
- **Decision-Making:** Chosen to enable the use of `await Sleep(ms)` throughout the codebase, making asynchronous flow control much more readable than nested callbacks.
- **Benefits:** Improves code clarity and reduces "callback hell" in complex asynchronous flows like scraping and retries.

## FindMyIp Utility (`src/util/FindMyIp.ts`)
Used to determine the current public IP address of the bot instance.
- **Approach:** Fetches data from external "What is my IP" services.
- **Benefits:** Useful for debugging and for services that might need to know their external network identity.

## EqualString Utility (`src/util/EqualString.ts`)
Provides robust string comparison.
- **Approach:** Often used for case-insensitive or normalized string comparisons.
- **Benefits:** Ensures consistent behavior when comparing user input or scraped data across different sources.

## Critiques & Suggestions for Improvement
-   **Critique:** Many of these utilities are scattered across the `util/` directory without a clear organizational structure. Some, like `Sleep`, are so basic they might be better replaced by standard Node.js utilities.
-   **Suggestion:** Consolidate related utilities into logical modules. For `Sleep`, use the built-in `require('timers/promises').setTimeout` available in modern Node.js versions.
