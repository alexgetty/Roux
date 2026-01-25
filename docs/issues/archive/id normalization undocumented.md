---
type: Issue
severity: Low
component: DocStore, Documentation
phase: Resolution
---

# ID Normalization Undocumented

## Problem

Node IDs are silently normalized to lowercase. Users querying with PascalCase paths get results with lowercase IDs, causing confusion.

**Reproduction:**
```json
{
  "ids": ["graph/Recipes/Bulgogi.md", "graph/Ingredients/Garlic.md"]
}
```

**Result:**
```json
{
  "graph/recipes/bulgogi.md": true,
  "graph/ingredients/garlic.md": true
}
```

Input was PascalCase, output is lowercase.

## Root Cause

`src/providers/docstore/parser.ts` `normalizeId()` lowercases all IDs for case-insensitive matching. This is intentional — filesystem case sensitivity varies by OS, and wiki-links need consistent resolution.

All API entry points normalize:
- `docstore.ts:172` - deleteNode
- `docstore.ts:132` - updateNode
- `docstore.ts:189` - getNode
- `docstore.ts:194` - getNodes
- `docstore.ts:253` - nodesExist

## Impact

- Users see different IDs in responses than they provided
- May cause confusion when storing/comparing IDs
- Not a bug, but unexpected behavior

## Suggested Fix

Document in MCP Tools Schema:

> **Note:** Node IDs are normalized to lowercase for case-insensitive matching. Input `graph/Recipes/Bulgogi.md` becomes `graph/recipes/bulgogi.md` in all responses.

## References

- Field report from Eldhrímnir vault testing (2026-01-24)
- `src/providers/docstore/parser.ts` - normalizeId function
