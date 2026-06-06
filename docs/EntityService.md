# EntityService

The `EntityService` (composed of `Entity` base class and `EntityFactory`) provides the base structure for all persistent objects in the application.

## Approach
1.  **Base Class:** All domain entities (like `CarPostingRecord` or `ScrapedPageRecord`) inherit from the `Entity` class.
2.  **Metadata Tracking:** Automatically tracks creation (`MIS_DT`), update (`UPDATED_DT`), and soft-deletion (`DELETED_DT`) timestamps.
3.  **Active Record Pattern:** Uses a repository pattern (often seen as `RecordRepository` in the code) to provide CRUD operations for these entities.

## Subjective Decision-Making
-   **Soft Deletion:** By including a `DELETED_DT` field in the base class, the system supports soft deletion by default. This is a subjective safety measure to prevent accidental data loss.
-   **Unix Timestamps:** Uses millisecond-precision Unix timestamps for dates instead of ISO strings. This makes date arithmetic simpler and consistent across the SQLite database.

## Benefits over Market Solutions
-   **Consistency:** Ensures that every table in the database has a standardized set of metadata fields.
-   **Simplicity:** Minimalist implementation that avoids the complexity of heavy ORMs while providing the essential features for data tracking.

## Critiques & Suggestions for Improvement
-   **Critique:** The `Entity` class manually manages timestamps, which can lead to inconsistencies if a developer forgets to update the `UPDATED_DT` field in a specific repository method.
-   **Suggestion:** Leverage Knex hooks or a lightweight ORM layer to automatically handle timestamp updates. Consider adding a formal `version` field to entities to support optimistic locking and prevent lost updates in concurrent scenarios.
