# MIS_DTUtility

The `MIS_DT` (Management Information System Date-Time) utility provides a standardized set of tools for date and time manipulation.

## Approach
1.  **Static Methods:** Provides a collection of static helper methods for common time-based operations.
2.  **Standardized Formatting:** Uses the `dateformat` library to ensure consistent date and time strings across the bot's UI and logs.
3.  **Time Arithmetic:** Includes helpers for common time durations (OneDay, OneHour, etc.) to make code more readable.

## Subjective Decision-Making
-   **Static Wrapper:** Wrapping these functions in a class instead of using standalone functions is a subjective choice to provide a clear namespace for time-related operations.
-   **Custom Formatting Strings:** The formatting strings (e.g., "dd.mm.yyyy") are hardcoded within the utility to maintain a consistent "look and feel" throughout the application.

## Benefits over Market Solutions
-   **Domain-Specific:** Tailored specifically to the needs of the assistant, providing exactly the formats and utilities needed without the bloat of a full library like Moment.js.
-   **Readability:** Replaces complex `Date` arithmetic with human-readable methods like `MIS_DT.GetDay()`.
