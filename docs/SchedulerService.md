# SchedulerService

The `SchedulerService` manages the execution of recurring tasks based on the time of day.

## Approach
1.  **Registration:** Tasks are registered with a target hour and a callback function.
2.  **Stateful Execution:** Uses `IntervalsExecution` to ensure that a task scheduled for a specific hour only runs once during that hour.
3.  **Heartbeat:** The `Interval` method is called periodically (e.g., every 15 minutes) to check if any scheduled tasks need to run.

## Subjective Decision-Making
-   **Hourly Granularity:** The scheduler operates on an hourly basis rather than minute-by-minute. This is a subjective choice to simplify the logic, as none of the current tasks (like backups) require more precision.
-   **Internal Heartbeat:** Instead of using a system-level cron job, the bot manages its own internal heartbeat. This makes the application more portable and easier to deploy in environments where cron access is limited.

## Benefits over Market Solutions
-   **Zero External Dependencies:** No need for `node-cron` or complex scheduling libraries.
-   **Integrated State:** Since it's built into the app, it can easily use the app's own persistence mechanisms to track execution history.

## Critiques & Suggestions for Improvement
-   **Critique:** The hourly granularity and internal heartbeat mean that a task might be delayed by up to 15 minutes depending on when the heartbeat runs. There is also no support for "missed" tasks if the bot was offline during the scheduled hour.
-   **Suggestion:** Improve the heartbeat frequency and implement a "catch-up" mechanism that checks for tasks that should have run while the bot was down.
