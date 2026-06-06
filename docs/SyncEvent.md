# SyncEvent

The `SyncEvent` utility provides a simple, serial asynchronous event emitter.

## Approach
1.  **Serial Execution:** Unlike the standard Node.js `EventEmitter`, `SyncEvent` executes its listeners sequentially and awaits each one before moving to the next.
2.  **Short-Circuiting:** If a listener returns a value other than `false`, the event chain is broken, and no further listeners are called.
3.  **Type-Agnostic:** Designed to handle any number of arguments, passing them through to all subscribers.

## Subjective Decision-Making
-   **Sequential over Parallel:** Sequential execution was chosen to ensure predictable behavior, especially when multiple handlers might want to "consume" the same message.
-   **Boolean Handled Flag:** Using a `false` return value as a "not handled" signal is a simple convention that avoids more complex middleware patterns.

## Benefits over Market Solutions
-   **Async-First:** Built from the ground up for `async/await`, avoiding the pitfalls of trying to use async functions with synchronous event emitters.
-   **Lightweight Middleware:** Provides basic middleware-like functionality (short-circuiting) without the overhead of a full-blown framework.

## Critiques & Suggestions for Improvement
-   **Critique:** The current implementation doesn't provide a way to prioritize listeners or handle errors within a specific listener without crashing the entire emission chain.
-   **Suggestion:** Add support for listener priorities and implement a `try-catch` wrapper around listener execution to allow the chain to continue (or fail gracefully) if a single listener throws an error.
