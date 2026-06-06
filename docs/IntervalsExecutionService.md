# IntervalsExecutionService

The `IntervalsExecutionService` tracks the execution of tasks to prevent redundant runs within the same time window (typically an hour).

## Approach
1.  **Flag-Based Tracking:** Tasks are identified by a unique string "flag".
2.  **Persistent and In-Memory:** Tracks executions both in a database table (`IntervalsExecutions`) and in a static in-memory array for immediate feedback.
3.  **Automatic Cleanup:** Automatically deletes execution records older than 30 days during each new execution to keep the database size manageable.

## Subjective Decision-Making
-   **Hourly Granularity:** The service uses `MIS_DT.GetHour()` as the primary bucket for tracking. This means a task flagged "backup" can only be recorded as "executed" once per hour. This is a simple but effective way to prevent task overlapping in a bot that heartbeats frequently.
-   **Static Memory Cache:** Checking a static array in addition to the database is a subjective optimization to avoid database hits for tasks that were just executed in the current session.

## Benefits over Market Solutions
-   **Idempotency Guarantee:** Simple way to make scheduled tasks idempotent across bot restarts.
-   **Self-Cleaning:** Built-in data retention policy prevents the execution log from growing indefinitely.
-   **Minimal API:** Only two core methods (`Executed` and `Execute`) make it very easy to integrate into any part of the application.

## Critiques & Suggestions for Improvement
-   **Critique:** The static in-memory cache is not synchronized across multiple instances of the bot. While not an issue for single-instance deployments, it could lead to race conditions in a scaled environment. The 30-day cleanup is hardcoded and may not fit all use cases.
-   **Suggestion:** Use a centralized cache like Redis for execution flags if scaling becomes necessary. Make the retention period a configurable setting in the `ConfigService`.
