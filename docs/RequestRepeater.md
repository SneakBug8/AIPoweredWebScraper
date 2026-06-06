# RequestRepeater

The `RequestRepeater` is a utility designed to handle flaky network requests or unstable API endpoints by implementing a robust retry mechanism.

## Approach
1.  **Retry Loop:** Attempts to execute a provided function multiple times (default 5) before giving up.
2.  **Concurrency Locking:** Uses a `requestrepeating` flag to prevent multiple retry loops from running simultaneously, ensuring that the system doesn't overwhelm an already struggling endpoint.
3.  **Graceful Failure:** If all tries fail, it returns a provided "backup" value instead of throwing an error, allowing the caller to continue with a safe default.

## Subjective Decision-Making
-   **Static Lock:** The use of a simple boolean flag for locking is a subjective choice for simplicity. While it limits concurrency, it acts as a primitive circuit breaker.
-   **Fixed Backoff:** Uses a short, fixed 200ms sleep between retries. While exponential backoff is more traditional, this fixed approach was deemed sufficient for the internal APIs and services used by the assistant.

## Benefits over Market Solutions
-   **Simplicity:** A single, easy-to-use wrapper function for any async operation.
-   **Built-in Concurrency Control:** Unlike most retry libraries, it includes basic protection against request storms out of the box.
