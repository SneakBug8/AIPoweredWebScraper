# FEAT-XXX — Feature Title

| FEAT | Title | Service | Status | Priority | Traceability (US) |
|------|-------|---------|--------|----------|--------------|
| FEAT-XXX | Feature Title | ServiceName | done/in progress/planned | must/should/could | US1, US2 |

> Copy this file to create a new feature record. Replace every placeholder.
> Use one file per feature. Name the file `FEAT-XXX-FeatureTitle.md`.

## 1. Overview

Describe the feature in one paragraph. State the problem it solves for the user and the value it delivers.

## 2. Business Requirements (BABOK)

List the business requirements that this feature realizes. Write each requirement as a measurable statement of need.

## 3. Scope

### In Scope

- Item 1.
- Item 2.

### Out of Scope

- Item 1.
- Item 2.

## 4. User Stories and Acceptance Criteria

Trace every user story and acceptance criterion to the source code. Add the `//US[ID]` and `//US[ID]AC[ID]` comments directly above the code that implements each item.

| Story ID | User Story |
|----------|------------|
| US1 | The user initiates the action with a command. |
| US1AC1 | The system performs the action asynchronously. |

## 5. Functional Requirements

Map each functional requirement to its user story. Use the format `FR-1 (US1)`.

## 6. Interfaces

### Commands

| Command | Action |
|---------|--------|
| `/command` | Description. |

### Web Routes

| Route | Method | Action |
|-------|--------|--------|
| `/path` | GET | Renders the dashboard. |

## 7. Data Model

Document the entities that this feature creates or reads. List the fields and the table name.

## 8. Implementation Notes

Record the key implementation decisions and the code locations.

## 9. Risks and Open Items

- Risk 1.
- Open item 1.

## 10. Verification

List the manual or automated checks that prove the feature works. Reference the exact commands to run.