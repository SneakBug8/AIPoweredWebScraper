# TelegramBotService

The `TelegramBotService` (centered in `src/index.ts`) is the primary interface through which users interact with the assistant.

## Approach
1.  **Event-Driven:** Uses `node-telegram-bot-api` to listen for incoming messages and commands.
2.  **Modular Handlers:** Implements a series of listener functions (Scraper, Backup, etc.) that are executed sequentially until one handles the message.
3.  **Command Pattern:** Uses regular expressions to match user input against known bot commands.
4.  **Asynchronous by Design:** All major operations (scraping, field extraction) are launched asynchronously, allowing the bot to remain responsive to other requests.

## Subjective Decision-Making
-   **Sequential Listeners:** The bot iterates through an array of listener functions. While a centralized router could be used, this sequential approach allows for easy "plugin-style" addition of new services.
-   **Blocking Input:** The `setWaitingForValue` mechanism allows the bot to temporarily enter a state where it waits for a specific user response, effectively creating a simple conversational flow.

## Benefits over Market Solutions
-   **Unified Interface:** Acts as a single point of control for scraping, backups, and data extraction.
-   **Instant Notifications:** The bot can proactively message the user about task completion or errors.
-   **Low Friction:** No need for a custom app or website for most operations; everything is accessible via a standard messaging app.
