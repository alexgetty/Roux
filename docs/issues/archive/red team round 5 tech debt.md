---
type: Issue
severity: Medium
component: MCP, Vector, DocStore, Integration
phase: 10
---

# Issue - Red Team Round 5 Tech Debt

Medium-priority issues from Phase 10 red-team audit round 5.

## MCP Handlers

### 1. Direction validation only tests 'in'

**Location:** `tests/unit/mcp/handlers.test.ts:255-265`

`handleGetNeighbors` test passes `direction: 'in'` but never explicitly tests `'out'`. The validation at line 275-284 confirms `'sideways'` is invalid but doesn't confirm `'out'` is valid and correctly passed to core.

**Fix:** Add test case with `direction: 'out'` verifying it's passed to `core.getNeighbors`.

### 2. Metric validation doesn't test 'pagerank'

**Location:** `tests/unit/mcp/handlers.test.ts:381-398`

Tests `out_degree` as valid and `betweenness` as invalid. According to `handlers.ts:149`, `pagerank` IS valid but never tested.

**Fix:** Add test case with `metric: 'pagerank'` verifying it's passed to `core.getHubs`.

### 3. sanitizeFilename edge cases

**Location:** `tests/unit/mcp/handlers.test.ts:824-840`

Tests `'!!!'` → `'untitled'` but doesn't test:
- `'!!!hello'` → should be `'hello'`
- `'hello!!!'` → should be `'hello'`
- `'---'` → should be `'untitled'`

**Fix:** Add edge case tests for leading/trailing special characters.

## Vector Provider

### 4. Full migration scenario untested

**Location:** `tests/unit/vector/sqlite.test.ts:219-240`

Tests overwrite single ID with different dimensions, but doesn't test full migration:
- Store 10+ vectors at 384-dim
- Overwrite ALL with 768-dim
- Verify search works correctly

**Fix:** Add comprehensive migration test with multiple vectors.

### 5. getEmbeddingCount() not tested

**Location:** `src/providers/vector/sqlite.ts:141-146`

Implementation has `getEmbeddingCount()` method but no test coverage.

**Fix:** Add test verifying count after store/delete operations.

### 6. close() twice behavior

**Location:** `tests/unit/vector/sqlite.test.ts`

No test for what happens if `close()` is called on an already-closed provider.

**Fix:** Add test verifying double-close doesn't throw.

## DocStore Watcher

### 7. Timer inconsistency

**Location:** `tests/unit/docstore/watcher.test.ts`

Lines 456-531 use `vi.useFakeTimers()` but other tests use `vi.waitFor` with real timers. Inconsistent pattern could cause flaky tests.

**Fix:** Standardize on one approach or document why both are needed.

### 8. Coalescing tests don't verify final cache state

**Location:** `tests/unit/docstore/watcher.test.ts:360-452`

Tests check that `onChange` was called with correct IDs, but don't verify the cache/graph actually reflects the coalesced result.

**Fix:** Add assertions that cache state matches expected after coalescing.

### 9. Restart watching not tested

**Location:** `tests/unit/docstore/watcher.test.ts`

No test for `startWatching()` after `stopWatching()`. Should verify watcher can be restarted.

**Fix:** Add test for start → stop → start cycle.

## Integration Tests

### 10. Inconsistent timeouts

**Location:** `tests/integration/watcher/file-events.test.ts`

Some tests use 5s timeout, others use 8s. No comments explaining why.

**Fix:** Standardize timeouts or document reasons for differences.

### 11. Link removal not tested

**Location:** `tests/integration/watcher/file-events.test.ts:153-174`

Tests that adding a link updates the graph, but doesn't test that removing a link also updates the graph.

**Fix:** Add test: create file with link, sync, modify to remove link, verify graph updated.

## References

- Phase 10 red-team audit round 5 (2026-01-24)
