---
id: oVjbHwQmCcbZ
title: Nodes Exist Schema Outdated
tags:
  - issue
  - mcp
  - documentation
---
# nodes_exist MCP Schema Shows Outdated ID Format

## Summary

The `nodes_exist` handler's schema description still references the old path-based ID format without mentioning the new nanoid format introduced in 0.2.

## Location

`src/mcp/handlers/nodes_exist.ts` line 15

## Current (Incorrect)

```typescript
description:
  'Node IDs to check existence. IDs are normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").',
```

## Expected

Should match other handlers like `get_node`, `update_node`, `delete_node`, etc:

```typescript
description:
  'Node IDs to check existence. Accepts either a stable nanoid (e.g., "abc123XYZ789") or a file path for backwards compatibility (e.g., "recipes/bulgogi.md"). Paths are normalized to lowercase. Prefer nanoid for direct lookup; path requires index scan.',
```

## Impact

Agents using the MCP see outdated documentation, leading them to expect path-based IDs when the system now uses nanoids as primary identifiers.

## Found By

Agent testing on Roux 0.2 was confused about ID format expectations.

## Fix

Update the schema description in `nodes_exist.ts` to match the pattern used in other ID-accepting handlers.
