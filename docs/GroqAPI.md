# GroqAPI

The `GroqAPI` service provides the integration layer with the Groq SDK for lightning-fast LLM inference.

## Approach
1.  **Direct SDK Integration:** Wraps the `groq-sdk` to provide a pre-configured instance using environment variables.
2.  **JSON Mode:** Specifically configured to use JSON schema enforcement (when supported by the model) to ensure the AI's output can be programmatically parsed without errors.

## Subjective Decision-Making
-   **Groq vs. OpenAI:** Groq was selected primarily for its extreme inference speed and competitive pricing, which is crucial for processing dozens of scraped pages in a reasonable timeframe.

## Benefits over Market Solutions
-   **Speed:** Significantly lower latency for chat completions compared to traditional cloud providers.
-   **Structured Data Reliability:** By using strict JSON schemas, the service eliminates the need for complex regular expression parsing of AI responses.
