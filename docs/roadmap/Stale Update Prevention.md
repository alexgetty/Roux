---
id: P81n4oEMOTZ-
title: Stale Update Prevention
tags:
  - roadmap
type: Feature
status: Proposed
priority: P2
effort: M
phase: Post-MVP
category: MCP Tools
---
# Stale Update Prevention

Prevent agents from overwriting user changes by using stale cached content.

## Problem

1. Agent reads file via `get_node`
2. User edits file externally (Obsidian, editor, etc.)
3. Agent calls `update_node` with content from step 1
4. User's changes are overwritten

## Why It's Complex

**Naive mtime tracking fails:** Writing changes the mtime, so post-write checks always see a mismatch.

**Optimistic locking requires schema changes:** Agent must pass version token, learn new behavior.

**Diff-based edits have their own problems:**
- Old string not found if file changed
- Multiple matches ambiguity
- Whitespace sensitivity
- Frontmatter/YAML corruption risk
- Still need stale detection anyway

## Research Needed

1. How do other collaborative editing systems handle this? (Google Docs, Notion, CRDTs)
2. What's the right granularity? File-level? Block-level?
3. Can we detect "significant change" vs "formatting change"?
4. How do we handle the UX of rejection? Agent needs clear recovery path.
5. Should this be opt-in or default behavior?

## Potential Approaches

- **Optimistic locking with content hash** — get_node returns hash, update_node requires matching hash
- **Last-write-wins with warning** — Detect change, warn but allow override
- **Diff/patch model** — Surgical edits that merge with external changes
- **Shadow copy** — Roux maintains "last agent view" separately from file

## Acceptance Criteria

- Agent cannot silently overwrite external changes
- Clear error message with recovery instructions
- Minimal schema/behavior changes for agent
- Works across session boundaries

## Origin

Field incident: Agent overwrote manual edits to `notes/hierarchy of understanding.md` using stale conversation cache.
