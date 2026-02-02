---
id: gqzXUiQvkHt3
title: audit-cli-status-test
tags:
  - test-audit
  - cli
status: open
---
# Test Audit: cli/status.test.ts

**Consolidated into:** [[consolidated-boundary-conditions]], [[consolidated-error-propagation-gaps]], [[consolidated-weak-assertions]]

## Summary

The status command tests cover basic happy paths but miss critical edge cases including error handling, resource cleanup verification, and the underlying data flow assumptions that could lead to false positives.

## Findings

### [HIGH] Edge Count Derived from Centrality Table Is Brittle

**Location:** `tests/unit/cli/status.test.ts:55-56`

**Problem:** The test expects `edgeCount: 1` but does not verify the mechanism. Edge count comes from `SUM(in_degree)` in the centrality table (cache.ts:345-348), which requires `sync()` to call `graphManager.build()` then `storeCentrality()`. If any part of this chain fails silently, the test could pass with edgeCount=0 and we'd never know links weren't being counted.

**Evidence:**
```typescript
// Test assumes this produces edgeCount: 1
await writeFile(join(testDir, 'a.md'), '---\ntitle: A\n---\n\nLinks to [[B]]', 'utf-8');
await writeFile(join(testDir, 'b.md'), '---\ntitle: B\n---\n\nContent', 'utf-8');
const store = new DocStore(testDir, join(testDir, '.roux'));
await store.sync();
// ...
expect(result.edgeCount).toBe(1);
```

The test does not verify:
1. The link was actually parsed from `a.md`
2. The link was resolved to `b.md`
3. The centrality table was populated

**Fix:** Add explicit assertions on the intermediate state:
1. After sync, verify `store.getNode('a.md')?.outgoingLinks` contains `'b.md'`
2. Or add a separate unit test for `Cache.getStats()` that directly populates the centrality table

**Verification:** A mutation test that breaks link parsing or centrality storage should cause this test to fail.

---

### [HIGH] No Test for Cache/VectorProvider Initialization Failure

**Location:** `src/cli/commands/status.ts:24-25`

**Problem:** If `Cache` or `SqliteVectorProvider` constructors throw (e.g., corrupted database, locked file), the error propagates uncaught. No test verifies this behavior.

**Evidence:**
```typescript
// status.ts - no try/catch around initialization
const cache = new Cache(cacheDir);
const vectorProvider = new SqliteVectorProvider(cacheDir);
```

**Fix:** Add tests for:
1. Corrupted `cache.db` (truncated file, invalid schema)
2. Locked database file (concurrent access)
3. Missing `.roux` directory with valid `roux.yaml`

**Verification:** Test should show graceful error message, not stack trace.

---

### [MEDIUM] Resource Cleanup Not Verified on Error Paths

**Location:** `src/cli/commands/status.ts:27-43`

**Problem:** The implementation uses `try/finally` for cleanup, but tests don't verify that `cache.close()` and `vectorProvider.close()` are called when `getStats()` or `getEmbeddingCount()` throw.

**Evidence:**
```typescript
// status.ts
try {
  const stats = cache.getStats();
  const embeddingCount = vectorProvider.getEmbeddingCount();
  // ...
} finally {
  cache.close();
  vectorProvider.close();
}
```

If `cache.getStats()` throws, `vectorProvider` is still closed. But if the Cache constructor throws, neither is closed (no resources to close yet). The subtlety is that a *partial* initialization (Cache succeeds, VectorProvider fails) would leak the Cache connection.

**Fix:** Add test with mock that throws on VectorProvider construction, verify Cache was still closed. Or refactor to ensure both are initialized before either is used.

**Verification:** Add a spy on `cache.close()` and verify it's called even when an error occurs.

---

### [MEDIUM] embeddingCoverage Division Edge Case Undocumented

**Location:** `tests/unit/cli/status.test.ts:94`

**Problem:** The test documents `0/0 = 1` as "by convention" but this is a behavioral contract that should be explicit in the implementation and tests.

**Evidence:**
```typescript
// Test comment
expect(result.embeddingCoverage).toBe(1); // 0/0 = 1 by convention
```

The implementation (status.ts:31-32):
```typescript
const embeddingCoverage =
  stats.nodeCount === 0 ? 1 : embeddingCount / stats.nodeCount;
```

**Fix:** 
1. The logic is correct, but add JSDoc to `StatusResult.embeddingCoverage` documenting the 0-node convention
2. Add a test that explicitly names this case: `'empty graph has full embedding coverage (0/0 convention)'`

**Verification:** Self-documenting test name and JSDoc.

---

### [MEDIUM] No Test for Negative or Inconsistent Stats

**Location:** `tests/unit/cli/status.test.ts` (missing)

**Problem:** No test verifies behavior when database returns unexpected values:
- Negative counts (corrupted data)
- `embeddingCount > nodeCount` (orphaned embeddings)
- Very large counts (integer overflow protection)

**Evidence:** Implementation blindly trusts database values:
```typescript
return {
  nodeCount: stats.nodeCount,
  edgeCount: stats.edgeCount,
  embeddingCount,
  embeddingCoverage,
};
```

**Fix:** Either add validation in the implementation, or document that status reflects raw database state (and add tests confirming this passthrough behavior).

**Verification:** Test with manually corrupted database showing stats pass through unvalidated.

---

### [LOW] Test Uses Real FileSystem and SQLite

**Location:** `tests/unit/cli/status.test.ts:13-20`

**Problem:** Unit tests create real files and SQLite databases in `tmpdir`. This makes tests slower and potentially flaky if cleanup fails. More importantly, it tests the integration, not the unit.

**Evidence:**
```typescript
beforeEach(async () => {
  testDir = join(tmpdir(), `roux-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(testDir, { recursive: true });
});
```

**Fix:** Consider whether these should be in `tests/integration/` or if `statusCommand` should accept injectable dependencies for true unit testing.

**Verification:** N/A - architectural decision.

---

### [LOW] StatusResult Type Not Tested for Contract Stability

**Location:** `src/cli/commands/status.ts:6-11`

**Problem:** The `StatusResult` interface is exported but tests don't verify the shape. If a field is added/removed, tests might not catch breaking changes.

**Evidence:**
```typescript
export interface StatusResult {
  nodeCount: number;
  edgeCount: number;
  embeddingCount: number;
  embeddingCoverage: number;
}
```

Tests destructure specific fields but don't assert "no extra fields" or "all expected fields present".

**Fix:** Add a contract test:
```typescript
expect(Object.keys(result).sort()).toEqual([
  'edgeCount', 'embeddingCount', 'embeddingCoverage', 'nodeCount'
]);
```

**Verification:** Adding a new field would require updating this assertion.

## References

- [[CLI Command Test Gaps]] - existing issue for CLI tests
- [[Cache]] - underlying cache implementation
- [[SqliteVectorProvider]] - vector storage
