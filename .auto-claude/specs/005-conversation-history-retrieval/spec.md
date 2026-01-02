# Conversation History Retrieval

Implement the ability to retrieve past conversations from the database, allowing users to resume previous agent sessions and review execution history.

## Rationale
Critical for session continuity. Without this, users lose context when refreshing or returning to the UI. Addresses the TODO in execution.routes.ts and mirrors functionality users expect from chat interfaces.

## User Stories
- As a developer, I want to view my past agent conversations so that I can review what was discussed and pick up where I left off

## Acceptance Criteria
- [ ] Users can view a list of past conversations
- [ ] Selecting a conversation loads the full message history
- [ ] Conversation metadata (agent, timestamp, status) is displayed
- [ ] Pagination works for conversations with many messages
