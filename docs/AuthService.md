# AuthService

The `AuthService` manages access control for the Telegram bot and web interface.

## Approach
The service uses a two-tiered authentication strategy:
1.  **Whitelisted Chat IDs:** Predetermined chat IDs (defined in environment variables) are granted immediate access.
2.  **Password-based Session:** Other users must provide a password (also defined in environment variables) to authorize their chat ID.

## Subjective Decision-Making
-   **Static Whitelist:** Choosing a static whitelist in environment variables over a database-driven user management system simplifies deployment and security for a personal assistant.
-   **Password Lifetime:** The current implementation keeps a chat ID authorized until the bot restarts or `ResetAuth` is called. This favors convenience over strict session expiration, which is acceptable for this use case.

## Benefits over Market Solutions
-   **Zero-Overhead:** No need for external OAuth providers or complex user registration flows.
-   **Privacy:** All authentication logic is local to the instance, ensuring that user data isn't shared with third-party auth services.
-   **Instant Access:** Whitelisting provides a seamless experience for the primary owner while still allowing controlled access for others.
