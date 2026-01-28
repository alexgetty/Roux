---
title: Roux Id Normalization Bug
tags:
  - issue
  - bug
  - mcp
type: Issue
priority: High
severity: High
component: MCP
status: open
---
# Roux MCP ID Normalization Bug Report

## Summary

The MCP `create_node` tool generates filenames using a different naming convention than existing files, causing:
1. **Broken wiki-links** — recipes link to `[[Sesame Oil]]` but file is `sesame-oil.md`
2. **False negatives from `nodes_exist`** — checking `graph/ingredients/sesame oil.md` returns `false` even when `sesame-oil.md` exists
3. **Inconsistent vault** — mix of `Title Case.md` and `lowercase-dash.md` files

## Root Cause Analysis

### The Naming Convention Mismatch

**Existing vault convention:**
```
Ingredients/Sesame Oil.md
Ingredients/Green Onion.md
Equipment/Cast Iron Pan.md
```

**MCP `create_node` output:**
```
Ingredients/sesame-oil.md
Ingredients/green-onion.md
Equipment/cast-iron-pan.md
```

### Code Flow

#### 1. `create_node` handler (`src/mcp/handlers.ts:281-321`)

```typescript
const filename = sanitizeFilename(title) + '.md';
const id = directory ? `${directory}/${filename}` : filename;
```

#### 2. `sanitizeFilename` function (`src/mcp/handlers.ts:461-470`)

```typescript
export function sanitizeFilename(title: string): string {
  const sanitized = title
    .toLowerCase()                    // "Sesame Oil" → "sesame oil"
    .replace(/[^a-z0-9\s-]/g, '')    // remove special chars
    .replace(/\s+/g, '-')            // "sesame oil" → "sesame-oil"  ← THE BUG
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'untitled';
}
```

The `.replace(/\s+/g, '-')` converts spaces to dashes, introducing a NEW naming convention.

#### 3. `normalizeId` function (`src/providers/docstore/parser.ts:90-92`)

```typescript
export function normalizeId(path: string): string {
  return path.toLowerCase().replace(/\\/g, '/');
}
```

This only lowercases and normalizes slashes. It does NOT normalize dashes/spaces.

#### 4. `nodes_exist` check (`src/providers/docstore/index.ts:252-255`)

```typescript
async nodesExist(ids: string[]): Promise<Map<string, boolean>> {
  const normalizedIds = ids.map(normalizeId);
  return this.cache.nodesExist(normalizedIds);
}
```

Since `normalizeId` doesn't convert spaces↔dashes, checking for `sesame oil.md` won't find `sesame-oil.md`.

### The Cascade Failure

1. **LLM calls `nodes_exist(["graph/ingredients/sesame oil.md"])`**
2. **Returns `false`** — file is `sesame-oil.md`, not `sesame oil.md`
3. **LLM calls `create_node(title: "Sesame Oil", directory: "graph/Ingredients")`**
4. **Creates `sesame-oil.md`** — due to `sanitizeFilename`
5. **Wiki-links break** — recipes link to `[[Sesame Oil]]` which normalizes to `sesame oil.md`

## Impact

In a single session, I created ~50 files with the wrong naming convention, requiring manual cleanup:
- Broken links across 100+ recipe references
- Inconsistent naming throughout the vault
- Manual file renames required

## Proposed Solutions

### Option A: Preserve Original Casing and Spaces (Recommended)

Change `sanitizeFilename` to preserve the original format:

```typescript
export function sanitizeFilename(title: string): string {
  // Only remove truly invalid filename characters
  // Preserve spaces and casing
  return title
    .replace(/[<>:"/\\|?*]/g, '')  // Remove only filesystem-invalid chars
    .replace(/\s+/g, ' ')          // Collapse multiple spaces
    .trim() || 'Untitled';
}
```

**Pros:**
- Matches existing vault conventions
- Wiki-links work naturally (`[[Sesame Oil]]` → `Sesame Oil.md`)
- No migration needed for existing vaults

**Cons:**
- Filenames with spaces (common in Obsidian, less common elsewhere)

### Option B: Normalize Everything to Lowercase-Dashes

Change `normalizeId` to also convert spaces to dashes:

```typescript
export function normalizeId(path: string): string {
  return path
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/\s+/g, '-');  // Add this
}
```

**Pros:**
- Consistent URL-friendly filenames
- All lookups normalize consistently

**Cons:**
- Breaks existing vaults with space-based naming
- Requires migration tooling
- Wiki-links need to be updated or link resolution enhanced

### Option C: Flexible Link Resolution (Defense in Depth)

Enhance wiki-link resolution to try multiple variants:

```typescript
private normalizeWikiLink(target: string): string {
  // Try: original, lowercase, with-dashes, with-spaces
  // Return first match found
}
```

**Pros:**
- Handles mixed conventions gracefully
- Backwards compatible

**Cons:**
- Adds complexity
- Potential for ambiguous matches

## Recommendation

**Implement Option A** (preserve original naming) as the primary fix, with **Option C** (flexible resolution) as defense in depth.

The Obsidian ecosystem uses spaces in filenames as standard. Fighting this convention creates friction. The MCP should respect the existing vault's naming patterns.

## Immediate Workaround

Until fixed, LLM consumers should:
1. **Not use `nodes_exist`** for pre-flight checks — it gives false negatives
2. **Create files directly via filesystem** if naming convention matters
3. **Check for both variants** when looking up nodes:
   - `graph/ingredients/sesame oil.md`
   - `graph/ingredients/sesame-oil.md`

## Files Affected

- `src/mcp/handlers.ts` — `sanitizeFilename` function
- `src/providers/docstore/parser.ts` — `normalizeId` function
- `src/providers/docstore/index.ts` — wiki-link resolution

## Test Cases Needed

```typescript
// Should find existing file regardless of dash/space format
expect(await store.nodesExist(['graph/ingredients/sesame oil.md'])).toBe(true);
expect(await store.nodesExist(['graph/ingredients/sesame-oil.md'])).toBe(true);

// Should create file matching existing convention
const node = await store.createNode({ title: 'Sesame Oil', ... });
expect(node.id).toBe('graph/ingredients/Sesame Oil.md');  // Not sesame-oil.md
```
