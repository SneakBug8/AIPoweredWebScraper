# MessageWrapper

The `MessageWrapper` is a decorator for the Telegram Bot API's message object, providing a more expressive and fluent interface.

## Approach
1.  **Fluent API:** Methods like `reply` and `deleteAfterTime` return the wrapper (or a new wrapper), allowing for chained operations.
2.  **Convenience Methods:** Provides high-level abstractions for common tasks like regex matching (`checkRegex`), capturing groups (`captureRegex`), and timestamp formatting.
3.  **Automatic Deletion:** Includes a built-in `deleteAfterTime` method to keep the chat history clean by automatically removing temporary messages.

## Subjective Decision-Making
-   **Class-Based Wrapper:** Wrapping the raw JSON message in a class was chosen to provide better IDE autocompletion and a more "object-oriented" feel to the message handling logic.
-   **In-Memory Timers:** The `deleteAfterTime` uses standard `setTimeout`. This is simple but means that pending deletions are lost if the bot restarts. This trade-off was made to keep the implementation lightweight and avoid complex persistent job queues.

## Benefits over Market Solutions
-   **Developer Experience:** Significantly reduces the boilerplate code required to perform common bot interactions.
-   **Cleaner Logic:** Encourages a more readable, declarative style for handling user input.

## Critiques & Suggestions for Improvement
-   **Critique:** `setTimeout` for message deletion is volatile; if the process crashes, scheduled deletions are lost, leaving clutter in the Telegram chat. The regex methods are convenient but could be more powerful if they supported typed captures.
-   **Suggestion:** Use a persistent job queue (like `bull` or a simple database table) for scheduled deletions. Enhance the regex helpers to return structured objects based on named capture groups.
