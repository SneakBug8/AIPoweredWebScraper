# ConfigService

The `ConfigService` acts as the central repository for all application settings and environment variables.

## Approach
1.  **Environment-Based:** Primarily pulls configuration from `process.env`, allowing for different settings in development and production environments.
2.  **Strict Mode:** Includes a `get()` method that throws an error if a requested key is missing, preventing the application from starting in an inconsistent state.
3.  **Path Resolution:** Provides centralized methods for resolving project and data paths, ensuring consistency across different operating systems.

## Subjective Decision-Making
-   **Class Singleton:** Using a class instance (singleton) provides a clean, namespaced way to access configuration throughout the app.
-   **Hardcoded Defaults:** Some values (like the port) are hardcoded in the class. While this makes them less flexible, it reduces the complexity of the `.env` file for standard deployments.

## Benefits over Market Solutions
-   **Type Safety:** By wrapping environment variables in a class, the application can provide better type hinting and validation than raw `process.env` access.
-   **Centralization:** Makes it easy to see all external dependencies (APIs, paths, credentials) in a single file.
