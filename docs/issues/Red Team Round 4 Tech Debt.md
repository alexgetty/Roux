---
type: Issue
severity: Medium
component: MCP, Vector
phase: 10
---

# Issue - Red Team Round 4 Tech Debt

Medium-priority issues from Phase 10 red-team audit round 4.

## MCP Handlers

### 1. Limit coercion allows floats

**Location:** `tests/unit/mcp/handlers.test.ts:152-168`

`Number('3.5')` → `3.5` passes through. If limits must be integers, should use `Math.floor` or `parseInt`. Current behavior: `limit: 3.5` → SQLite truncates during `LIMIT 3.5`.

**Fix:** Either document float behavior or add integer coercion.

### 2. handleGetNode depth=1 truncation not tested

**Location:** `tests/unit/mcp/handlers.test.ts:198-209`

Test uses mock with only 1 neighbor each. Doesn't verify that >20 neighbors get truncated to 20. Truncation happens in `transforms.ts:97-98`.

**Fix:** Add test with >20 neighbors to verify truncation.

### 3. Search score test hardcodes implementation detail

**Location:** `tests/unit/mcp/handlers.test.ts:81-95`

Test encodes `0.95` for second result (from formula `1 - index * 0.05`). If scoring changes, test breaks without behavioral failure.

**Fix:** Test "scores are descending" instead of exact values.

## Vector Provider

### 4. Constructor test doesn't verify passed DB remains usable

**Location:** `tests/unit/vector/sqlite.test.ts:361-373`

When `ownsDb = false`, provider shouldn't close the passed-in database. Test doesn't verify `db.open` is still true after `providerWithDb.close()`.

**Fix:** Add assertion that passed DB remains usable after provider close.

### 5. Float32 precision loss not explicitly tested

**Location:** `tests/unit/vector/sqlite.test.ts:84-119`

`[0.1, 0.2, 0.3]` as Float32 doesn't round-trip exactly. Tests use `toBeCloseTo` which masks this. No explicit test that precision loss is within acceptable bounds.

**Fix:** Low priority - add explicit precision test if issues arise.

## Roadmap

### Concurrent dispatchTool calls

**Location:** `tests/unit/mcp/handlers.test.ts:66-81`

MVP targets single-user stdio access. Worth testing post-MVP for HTTP transport.

### High-dimensional performance

**Location:** `tests/unit/vector/sqlite.test.ts:121-165`

384/768/1536-dim tests don't benchmark performance. Post-MVP should add index if needed.

### True concurrent writes

**Location:** `tests/unit/vector/sqlite.test.ts`

`Promise.all` isn't true concurrency in single-threaded Node. Real concurrent writes need Worker threads. SQLite handles this at filesystem level.

## References

- Phase 10 red-team audit round 4 (2026-01-24)
