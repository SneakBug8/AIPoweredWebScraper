# ErrorLogger

The `ErrorLogger` provides a standardized way to log and format errors throughout the application.

## Approach
1.  **JSON Formatting:** Attempts to parse and re-format errors as JSON for better readability in log files and consoles.
2.  **Safe Fallback:** If JSON parsing fails, it falls back to a standard `console.error` to ensure the error message is never lost.

## Subjective Decision-Making
-   **Console-Centric:** The logger currently only outputs to the console. This assumes that the application is running in a managed environment (like PM2 or Docker) that captures and persists console logs.
-   **Recursive JSON Parsing:** The use of `JSON.parse(JSON.parse(e))` is a defensive attempt to handle double-encoded error strings, which can sometimes occur in certain error reporting chains.

## Benefits over Market Solutions
-   **Minimalist:** No heavy logging frameworks (like Winston or Bunyan) required.
-   **Zero Configuration:** Works out of the box without needing to configure log rotations, transports, or levels.

## Critiques & Suggestions for Improvement
-   **Critique:** The double-parsing logic (`JSON.parse(JSON.parse(e))`) is a fragile hack that suggests underlying issues with how errors are being stringified elsewhere in the system. Relying solely on console output makes it difficult to implement automated alerts or centralize logs.
-   **Suggestion:** Standardize error creation across the app to avoid double-encoding. Integrate a logging transport (like `winston-transport`) to allow for multi-destination logging (e.g., console, file, and an external monitoring service like Sentry or Datadog).
