# WebApiService

The `WebApiService` provides a web-based management interface for the assistant.

## Approach
1.  **Framework:** Built on `express.js`, the industry-standard web framework for Node.js.
2.  **Templating:** Uses `ejs` for server-side rendering of dynamic pages.
3.  **Security:** Implements a simple password-based middleware that checks for a password in cookies or query parameters.
4.  **Session Management:** Uses `express-session` and `cookie-parser` to maintain authenticated states.

## Subjective Decision-Making
-   **Server-Side Rendering:** EJS was chosen over a modern SPA framework (like React or Vue) to keep the project's build process simple and minimize client-side complexity.
-   **Query Param Auth:** Allowing the password in the query string is a subjective convenience feature, allowing for "one-click" authenticated bookmarks, though it trades off some security (as the password might appear in browser history).

## Benefits over Market Solutions
-   **Integrated Dashboard:** Provides a way to view and manage scraped data without needing to use the Telegram interface.
-   **Extensible:** The middleware-based architecture makes it easy to add new routes or protected resources as the project grows.
-   **Lightweight:** Avoids the heavy dependencies and build times associated with modern frontend frameworks.

## Critiques & Suggestions for Improvement
-   **Critique:** The authentication is extremely basic and doesn't support multiple users or granular permissions. Storing the password in plain text in cookies is a significant security risk.
-   **Suggestion:** Implement a proper user session store with hashed password authentication. Switch to a more secure session management approach using `express-session` with a persistent store (like Redis or the existing SQLite database) and secure, HTTP-only cookies.
