---
title: MCP Contract Violations Audit
tags:
  - Issue
  - red-team
  - mcp
  - audit
---
# MCP Contract Violations Audit

Red-team audit of contract mismatches between what MCP exposes vs. what underlying modules provide.

**Audit date:** 2026-01-25

---

## ~~Critical: `get_hubs` Metric Enum Mismatch~~ RESOLVED

Handler `VALID_METRICS` updated to match schema - both now only allow `in_degree` and `out_degree`.

---

## High Priority (Green Team Action Required)

### 1. `list_nodes` Path Filter Case Sensitivity

**Location:** `cache.ts:268-269`

**Schema Promise:** `'Filter by path prefix (startsWith, case-insensitive)'`

**Reality:**
```typescript
conditions.push("id LIKE ? || '%'");
```

SQLite `LIKE` is case-sensitive by default. Query `path: "Recipes"` won't match `recipes/pasta.md`.

**Fix:** 
```typescript
conditions.push("LOWER(id) LIKE LOWER(?) || '%'");
```

---

### 2. `searchByTags` Limit Not Passed to Store

**Locations:** 
- Handler: `handlers.ts:256`
- GraphCore: `graphcore.ts:167-178`
- Interface: `provider.ts:94`

**Problem:** Limit only applied via `slice()` after loading ALL matching nodes:
```typescript
// GraphCore
const results = await store.searchByTags(tags, mode);  // Loads everything
if (limit !== undefined) {
  return results.slice(0, limit);  // Then truncates
}
```

**Impact:** With 10k nodes tagged "recipe", `limit: 5` still loads all 10k into memory.

**Fix:**
1. Add `limit?: number` to `StoreProvider.searchByTags` signature
2. Push `LIMIT` clause to SQL in `Cache.searchByTags`

---

## Medium (Logged to docs/issues/)

- `update_node` title schema says "renames file" but doesn't → `mcp-updatenode-title-rename-mismatch.md`
- `create_node` ID transformation undocumented → `mcp-createnode-id-transformation-undocumented.md`  
- `resolve_nodes` exact strategy threshold behavior unclear → `mcp-resolvenodes-exact-strategy-threshold-confusion.md`

## Low (No Action)

- Neighbor fetch duplication (inefficiency, not correctness)
- Search score approximation (documented behavior)
