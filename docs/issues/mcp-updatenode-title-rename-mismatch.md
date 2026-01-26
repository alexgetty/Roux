---
type: Issue
severity: Medium
component: MCP
phase: MVP
title: MCP update_node Title Rename Mismatch
tags:
  - Issue
  - mcp
  - medium
---

# update_node Title Rename Mismatch

## Problem

Schema description (`server.ts:215-216`) claims:
```typescript
title: {
  description: 'New title (renames file for DocStore)',
}
```

But DocStore.updateNode (`docstore/index.ts:149`) explicitly preserves the ID:
```typescript
id: existing.id,  // ID cannot be changed
```

The MCP handler checks for incoming links before allowing title changes (`handlers.ts:356-364`), implying rename would break links. But since the file isn't actually renamed, this check is meaningless.

## Impact

- LLM believes title change renames file (potentially breaking links)
- Link integrity check rejects valid operations for no benefit
- Schema lies about behavior

## Suggested Fix

Option A (Schema truth): Remove incoming-link check, update schema to say "Updates title in frontmatter. File path/ID unchanged."

Option B (Make it real): Actually rename file on title change, making the link check meaningful. Requires updating all references.

Option A is simpler and matches current behavior.

## References

- Red-team audit (2026-01-25)
