---
id: 8mzUJEwZcPjA
title: Standardize Create Node Params
tags:
  - issue
  - mcp
  - enhancement
  - api
type: '[[Enhancement]]'
priority: High
component: '[[MCP]]'
status: open
---
# Standardize `create_node` params to use `id`

## Problem

`create_node` uses `title` + `directory` while all other operations use `id`. This asymmetry caused confusion when a consumer Claude passed `directory="Ingredients"` expecting it to resolve relative to `graph/` (where they'd been reading from), but it created `./Ingredients/` at the store root.

The current interface also silently sanitizes filenames (kebab-case, lowercase) which doesn't match the actual vault conventions.

## Current API Asymmetry

| Operation | Interface |
|-----------|-----------|
| `get_node` | `id="graph/Ingredients/Ground Beef.md"` |
| `update_node` | `id="graph/Ingredients/Ground Beef.md"` |
| `delete_node` | `id="graph/Ingredients/Ground Beef.md"` |
| `create_node` | `title="Elbow Macaroni"` + `directory="Ingredients"` |

## Solution

Change `create_node` to take `id` (full path) instead of `title` + `directory`. Title becomes optional—derived from filename if not provided.

**Before:**
```typescript
create_node({ title: "Elbow Macaroni", directory: "Ingredients", content: "..." })
// Creates: ingredients/elbow-macaroni.md (sanitized, ambiguous location)
```

**After:**
```typescript
create_node({ id: "graph/Ingredients/Elbow Macaroni.md", content: "..." })
// Creates: graph/Ingredients/Elbow Macaroni.md (exactly as specified)
```

## Files to Modify

### `src/mcp/handlers.ts`
- `handleCreateNode` (lines 245-285):
  - Replace `title` + `directory` params with `id` (required) + `title` (optional)
  - Derive title from filename if not provided: extract basename, strip `.md`
  - Remove `sanitizeFilename` from id construction
  - Keep `sanitizeFilename` export (still useful elsewhere)

### `src/mcp/server.ts`
- `TOOL_SCHEMAS.create_node` (lines 165-188):
  ```typescript
  create_node: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Full path for new node (e.g., "graph/Notes/My Note.md")',
      },
      title: {
        type: 'string',
        description: 'Optional: display title. Defaults to filename without extension.',
      },
      content: { ... },  // unchanged
      tags: { ... },     // unchanged
    },
    required: ['id', 'content'],
  }
  ```

### `tests/unit/mcp/handlers.test.ts`
Update all `handleCreateNode` tests to use `id` instead of `title` + `directory`.
