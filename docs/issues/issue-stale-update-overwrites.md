---
title: issue-stale-update-overwrites
tags:
  - issue
  - roux
---
# Issue: Stale Update Overwrites in Roux MCP

## Summary
Agent updated a node using cached content from earlier in the conversation, overwriting user changes made outside the session.

## What Happened
1. Agent read `notes/hierarchy of understanding.md` via `get_node`
2. Agent made several updates via `update_node`
3. User made manual edits to the file outside the conversation (in Obsidian)
4. Agent called `update_node` again, but used the stale cached version from memory instead of re-reading
5. User's manual changes were overwritten

## Why It Happened
- `update_node` accepts full content replacement
- No mechanism exists to detect or prevent stale writes
- Agent relied on conversation memory instead of fetching fresh state
- CLAUDE.md rules exist for the `Edit` tool ("read before edit") but not for MCP tools, and agent compliance with rules is inconsistent

## Impact
- User lost manual edits
- Trust erosion in collaborative editing workflows
- Required manual restoration of lost content

## Mitigations Considered

### CLAUDE.md Rule
Add instruction to always `get_node` before `update_node`.
**Rejected**: Agent already has similar rules for file editing and failed to follow them. Rules are not reliable enforcement.

### Hook
Pre-hook on `mcp__roux__update_node` to enforce read-first behavior.
**Rejected**: Hooks run shell commands and cannot access agent state to verify a recent read occurred.

### MCP Server-Side Enforcement (Proposed)
Modify Roux to track read state and reject stale updates.

## Proposed Solution: Read-Before-Write Enforcement in Roux

### Mechanism
1. Track `get_node` calls per node ID with timestamp
2. On `update_node`, check if a `get_node` for that ID occurred within a configurable window (e.g., same session, last N seconds, or last N calls)
3. If no recent read: reject the update with an error message instructing the agent to read first

### Configuration Options
- `requireReadBeforeUpdate`: boolean (enable/disable enforcement)
- `readValidityWindow`: number (seconds) or "session" - how long a read remains valid
- Could be set in `roux.yaml` or passed as parameter

### Edge Cases to Handle
- What defines a "session"? Roux may not have session awareness.
- Should creating a node count as a "read" for subsequent updates?
- Should the window be time-based, call-count-based, or require immediate preceding read?

### Alternative: Optimistic Locking
- Return a version/hash with `get_node`
- Require that hash be passed to `update_node`
- Reject if hash doesn't match current file state
- More robust but requires schema changes

## Acceptance Criteria
- Agent cannot overwrite file content without having read the current state
- Error message clearly instructs agent to read first
- Feature can be disabled for workflows that don't need it

## Related
- [[Roux]]
- [[notes/hierarchy of understanding.md]] (the file that was affected)
