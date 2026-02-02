---
id: UABrVPOuIvPm
title: Create Node API Consolidation Brief
tags:
  - issue
  - mcp
  - brief
  - resolved
type: Implementation Brief
priority: High
status: resolved
component: MCP
consolidates:
  - '[[Standardize create_node params]]'
  - '[[Roux Id Normalization Bug]]'
  - '[[MCP create_node ID Transformation Undocumented]]'
  - '[[CreateNode Case Normalization]]'
  - '[[SanitizeFilename Edge Cases]]'
---
# Create Node API Consolidation Brief

## Executive Summary

The `create_node` MCP tool has a fundamentally different interface than all other node operations. This asymmetry cascades into filename convention mismatches, broken wiki-links, false negatives from `nodes_exist`, and unpredictable ID transformations. Six separate issues trace back to this root cause.

## The Core Problem

### API Asymmetry

Every node operation uses `id` as the primary identifier — except `create_node`:

| Operation | Interface |
|-----------|-----------|
| `get_node` | `id="graph/Ingredients/Sesame Oil.md"` |
| `update_node` | `id="graph/Ingredients/Sesame Oil.md"` |
| `delete_node` | `id="graph/Ingredients/Sesame Oil.md"` |
| `nodes_exist` | `ids=["graph/Ingredients/Sesame Oil.md"]` |
| **`create_node`** | `title="Sesame Oil"` + `directory="Ingredients"` |

This forces `create_node` to synthesize an ID from components, which introduces `sanitizeFilename` — the source of all downstream issues.

### The sanitizeFilename Transform

```typescript
// src/mcp/handlers.ts:461-470
export function sanitizeFilename(title: string): string {
  const sanitized = title
    .toLowerCase()                    // "Sesame Oil" → "sesame oil"
    .replace(/[^a-z0-9\s-]/g, '')    // strips special chars
    .replace(/\s+/g, '-')            // "sesame oil" → "sesame-oil"
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'untitled';
}
```

This creates `sesame-oil.md` when the vault convention is `Sesame Oil.md`.

## Consistent Symptoms Across Issues

### 1. Broken Wiki-Links

**Source:** [[Roux Id Normalization Bug]]

Recipes link to `[[Sesame Oil]]` which resolves to `sesame oil.md`. But the file created is `sesame-oil.md`. Links break silently.

### 2. False Negatives from nodes_exist

**Source:** [[Roux Id Normalization Bug]]

LLM checks `nodes_exist(["graph/ingredients/sesame oil.md"])` → returns `false` because the actual file is `sesame-oil.md`. LLM creates duplicate, compounding the inconsistency.

### 3. Unpredictable ID Generation

**Source:** [[MCP create_node ID Transformation Undocumented]]

Given `title="My Recipe: Curry & Rice!"`, the resulting ID is `my-recipe-curry-rice.md`. LLM cannot predict this without reading the response, forcing an extra round-trip for chained operations.

### 4. Ambiguous Directory Resolution

**Source:** [[Standardize create_node params]]

`directory="Ingredients"` is ambiguous — relative to what? A consumer working in `graph/` might expect `graph/Ingredients/` but get `./Ingredients/` at store root.

### 5. Case Normalization Behavior Unclear

**Source:** [[CreateNode Case Normalization]]

`normalizeId` lowercases paths, but interaction with `sanitizeFilename` is untested. What happens with `id="UPPERCASE.MD"`? Does filesystem match cache?

## Edge Cases to Preserve

From [[SanitizeFilename Edge Cases]] — these inputs need handling regardless of solution:

| Input | Current Output | Note |
|-------|----------------|------|
| `'!!!'` | `'untitled'` | All-special-char fallback |
| `'!!!hello'` | `'hello'` | Leading specials stripped |
| `'---'` | `'untitled'` | All-hyphen fallback |
| `'--hello--'` | `'hello'` | Leading/trailing hyphens stripped |

Even if `sanitizeFilename` is removed from ID construction, these cases matter for **title derivation** (extracting display title from filename).

## Proposed Solution

### Change create_node to Accept `id`

**Before:**
```typescript
create_node({ 
  title: "Sesame Oil", 
  directory: "graph/Ingredients", 
  content: "..." 
})
// Creates: graph/ingredients/sesame-oil.md (transformed, unpredictable)
```

**After:**
```typescript
create_node({ 
  id: "graph/Ingredients/Sesame Oil.md", 
  content: "..." 
})
// Creates: graph/ingredients/sesame oil.md (lowercased, spaces preserved)
```

### Schema Change

```typescript
create_node: {
  properties: {
    id: {
      type: 'string',
      description: 'Full path for new node (must end in .md). Will be lowercased. Example: "notes/My Note.md" creates "notes/my note.md"',
    },
    title: {
      type: 'string', 
      description: 'Optional display title. Defaults to filename without .md extension.',
    },
    content: { /* unchanged */ },
    tags: { /* unchanged */ },
  },
  required: ['id', 'content'],
}
```

### Title Derivation

When `title` is omitted, derive from `id`:
```typescript
function deriveTitle(id: string): string {
  const basename = id.split('/').pop() || 'Untitled';
  return basename.replace(/\.md$/i, '');
}
// "graph/Ingredients/Sesame Oil.md" → "Sesame Oil"
```

### Retain sanitizeFilename for Edge Cases

Keep `sanitizeFilename` but use it only for:
1. Sanitizing derived titles (not IDs)
2. Fallback to `'Untitled'` for degenerate inputs

## Decisions

### 1. Directory Creation — YES (recursive)

Already implemented, keep current behavior. `mkdir -p` semantics — if parent directories don't exist, create them.

### 2. Extension Enforcement — REJECT without `.md`

Do not auto-append. If ID doesn't end in `.md`, return clear error: `"ID must end with .md extension"`.

**Future consideration:** When adding support for other file types (`.html`, `.txt`), revisit extension handling. Add to roadmap.

### 3. Backwards Compatibility — NO

Hard break. Remove `title`+`directory` params entirely. LLMs receive the schema via MCP — no hardcoded calls exist that would break. Clean cut, no deprecation period.

## Files to Modify

| File | Changes |
|------|---------|
| `src/mcp/handlers.ts` | Replace `title`+`directory` with `id`, add title derivation, add `.md` validation |
| `src/mcp/server.ts` | Update TOOL_SCHEMAS.create_node |
| `tests/unit/mcp/handlers.test.ts` | Rewrite create_node tests for new interface |

## Test Cases Required

### Core Behavior
```typescript
it('creates node at exact ID path (lowercased)', async () => {
  const result = await handleCreateNode(core, { 
    id: 'notes/My Note.md', 
    content: 'Hello' 
  });
  expect(result.id).toBe('notes/my note.md');
});

it('derives title from filename when not provided', async () => {
  const result = await handleCreateNode(core, { 
    id: 'graph/Ingredients/Sesame Oil.md', 
    content: '...' 
  });
  expect(result.title).toBe('Sesame Oil');
});

it('uses explicit title when provided', async () => {
  const result = await handleCreateNode(core, { 
    id: 'notes/abbrev.md', 
    title: 'Full Descriptive Title',
    content: '...' 
  });
  expect(result.title).toBe('Full Descriptive Title');
});
```

### Case Normalization
```typescript
it('normalizes ID case consistently', async () => {
  await handleCreateNode(core, { id: 'FOLDER/NOTE.MD', content: '' });
  
  // Should be findable with any case
  expect(await core.getNode('folder/note.md')).not.toBeNull();
  expect(await core.getNode('FOLDER/NOTE.MD')).not.toBeNull();
});
```

### Validation
```typescript
it('rejects empty id', async () => {
  await expect(handleCreateNode(core, { id: '', content: '' }))
    .rejects.toThrow();
});

it('rejects id without .md extension', async () => {
  await expect(handleCreateNode(core, { id: 'notes/file', content: '' }))
    .rejects.toThrow(/must end with .md/i);
});

it('rejects id without .md extension even with other dots', async () => {
  await expect(handleCreateNode(core, { id: 'notes/file.txt', content: '' }))
    .rejects.toThrow(/must end with .md/i);
});
```

### Directory Creation
```typescript
it('creates nested directories that do not exist', async () => {
  const result = await handleCreateNode(core, { 
    id: 'deep/nested/path/note.md', 
    content: '' 
  });
  expect(result.id).toBe('deep/nested/path/note.md');
});
```

## Issues Resolved by This Change

| Issue | Status After |
|-------|--------------|
| [[Standardize create_node params]] | Resolved — API now uses `id` |
| [[Roux Id Normalization Bug]] | Resolved — no filename transformation |
| [[MCP create_node ID Transformation Undocumented]] | Obsolete — no transformation to document |
| [[CreateNode Case Normalization]] | Addressed — tests added for normalizeId behavior |
| [[SanitizeFilename Edge Cases]] | Deprioritized — function no longer in critical path |
