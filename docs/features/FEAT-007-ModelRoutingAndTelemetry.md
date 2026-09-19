# FEAT-007 — Model Routing and Request Telemetry

| FEAT | Title | Service | Status | Priority | Traceability (US) |
|------|-------|---------|--------|----------|--------------|
| FEAT-007 | Model routing and request telemetry | ModelUseBalancer, ModelRequest | done | must | US14, US23, US100 |

## 1. Overview

The service routes every LLM request to the most appropriate available model, applies rate-limit locks, and logs every request to a per-month telemetry database.

## 2. Business Requirements (BABOK)

- BR-1: The service must select the best model for each request.
- BR-2: The service must filter models by capability, such as tool use and structured output.
- BR-3: The service must record every model request for analysis.
- BR-4: The service must keep the telemetry history bounded by time.
- BR-5: The service must support multiple model API providers.

## 3. Scope

### In Scope

- Balanced request execution with model selection.
- Capability filtering of candidate models.
- Rate-limit locking between requests.
- JSON schema enforcement for structured output.
- Per-month telemetry logs.
- Multi-provider API adapters.

### Out of Scope

- Prompt engineering for individual feature domains.

## 4. User Stories and Acceptance Criteria

| Story ID | User Story |
|----------|------------|
| US14 | Model request telemetry: every balancer request is logged with its provider and model. |
| US14AC5 | Logs live in a separate per-month database file so old months stay small. |
| US14AC10 | The month connection is resolved lazily per query and cached. |
| US23 | ModelUseBalancer routes each agent request to the most appropriate available model. |
| US23AC5 | ModelUseBalancer filters candidate models by capability. |
| US23AC10 | The balanced request filters models, waits for rate-limit locks, and applies the balancer. |
| US23AC20 | BalancedPromptRequest wraps a single-message request without tool handling. |
| US23AC25 | BalancedAIRequestSkimmed issues a request but leaves tool calls unprocessed. |
| US100 | The system supports multiple model API providers. |

## 5. Functional Requirements

| Req ID | Requirement | Trace |
|--------|-------------|-------|
| FR-1 | Select the appropriate model for each request. | US23 |
| FR-2 | Filter candidate models by capability before selection. | US23AC5 |
| FR-3 | Await rate-limit locks before sending a request. | US23AC10 |
| FR-4 | Issue single-message requests without tool handling. | US23AC20 |
| FR-5 | Return responses with unprocessed tool calls for the agent loop. | US23AC25 |
| FR-6 | Log every request with its provider and model. | US14 |
| FR-7 | Store the telemetry in a per-month database file. | US14AC5 |
| FR-8 | Resolve and cache the month connection lazily. | US14AC10 |
| FR-9 | Support Groq, OpenRouter, Opencode, and Kilo providers. | US100 |

## 6. Interfaces

This feature exposes no user commands. The web and bot layers consume the balanced request API directly.

## 7. Data Model

Entity: model request records, stored in per-month database files named `YYYYMM_ModelRequestLogs.db`.

| Field | Type | Meaning |
|-------|------|---------|
| provider | text | The API provider. |
| model | text | The model that served the request. |
| timestamp | integer | The request time. |

## 8. Implementation Notes

- Core code: `src/assistant/ModelUseBalancer.ts`, `src/assistant/ModelRequest.ts`.
- The balancer request methods live in `src/api/groq.ts`, `src/api/openrouter.ts`, `src/api/opencode.ts`, and `src/api/kilo.ts`.
- The month connection is lazy and cached per month, so a month boundary needs no restart.
- The provider enum allows an interchangeable API-key scheme.

## 9. Risks and Open Items

- The telemetry columns were added after the first log tables shipped; existing files may need a column migration.
- Provider parity is not guaranteed: each provider supports a different capability set.

## 10. Verification

1. Trigger a scraping extraction and confirm the request succeeds.
2. Confirm a new telemetry file appears for the current month.
3. Confirm the log captures the provider and model identifiers.