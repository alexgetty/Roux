---
id: 8cLbtxQsrwBt
title: audit-core-graphcore-test
tags:
  - test-audit
  - core
status: open
---
# Test Audit: core/graphcore.test.ts

**Consolidated into:** [[consolidated-weak-assertions]], [[consolidated-boundary-conditions]], [[consolidated-empty-string-validation]]

## Summary

The test file has solid coverage for happy paths and basic error handling but contains several gaps around edge cases, assertion weakness, and untested code paths. Five findings across search, getNode, createNode, and resolveNodes.

## Findings

### [MEDIUM] Search: No assertion on score values in results

**Location:** `tests/unit/core/graphcore.test.ts:167-180`

**Problem:** The test "converts distance to score" claims to verify score conversion but never actually asserts on the score values. The comment explains the formula `1 / (1 + distance)` but the test only checks array length and first result ID.

**Evidence:**
```typescript
it('converts distance to score (higher = better)', async () => {
  // ...
  const results = await core.search('test');

  // Score formula: 1 / (1 + distance)
  // distance 0.1 -> score ~0.909
  // distance 0.5 -> score ~0.667
  // Results should be ordered by score descending (already is since distance ascending)
  expect(results).toHaveLength(2);
  expect(results[0]?.id).toBe('a.md');
  // NOTE: No assertion on actual score values!
});
```

**Fix:** Assert that results contain score property with expected values. The GraphCore interface doesn't expose scores in search results though - so either the test description is misleading, or the interface needs to return scores for this to be testable. Verify the actual contract.

**Verification:** Check if `SearchResult` type includes score. If yes, add score assertions. If no, rename test to reflect what it actually verifies (ordering).

---

### [MEDIUM] Search: Missing test for threshold option

**Location:** `tests/unit/core/graphcore.test.ts:144-223`, `src/types/graphcore.ts:15-21`

**Problem:** `SearchOptions` interface defines a `threshold` option, but no test verifies its behavior. The implementation (`src/core/graphcore.ts:55-66`) doesn't appear to use threshold at all.

**Evidence:**
```typescript
// From src/types/graphcore.ts:15-21
export interface SearchOptions {
  /** Default: 10 */
  limit?: number;
  /** 0-1 */
  threshold?: number;  // Defined but unused
  tags?: string[];     // Also defined but unused
}

// From src/core/graphcore.ts:55-66
async search(query: string, options?: SearchOptions): Promise<Node[]> {
  const store = this.requireStore();
  const embedding = this.requireEmbedding();

  const limit = options?.limit ?? 10;  // Only limit is used
  const vector = await embedding.embed(query);
  const results = await store.searchByVector(vector, limit);
  // No threshold filtering, no tag filtering
```

**Fix:** Either:
1. Implement threshold and tags filtering in search(), then add tests
2. Remove unused options from SearchOptions interface
3. Document that these options are not yet implemented

**Verification:** If implementing, add tests for threshold filtering and tag pre-filtering. If removing, update interface.

---

### [HIGH] GetNode: Depth > 1 behavior undefined

**Location:** `tests/unit/core/graphcore.test.ts:250-317`, `src/core/graphcore.ts:68-100`

**Problem:** Tests cover depth=0 and depth=1 but not depth > 1. The implementation treats any non-zero depth the same as depth=1, but this isn't documented or tested.

**Evidence:**
```typescript
// From src/core/graphcore.ts:76-78
if (!depth || depth === 0) {
  return node;
}
// depth=1, depth=2, depth=100 all get the same behavior
```

**Fix:** Add explicit test for depth > 1 to document current behavior:
```typescript
it('treats depth > 1 same as depth = 1 (no multi-hop traversal)', async () => {
  // Setup with nested neighbors
  // Assert that depth=2 only returns immediate neighbors, not 2-hop neighbors
});
```

**Verification:** Test should pass documenting that multi-hop traversal isn't implemented.

---

### [MEDIUM] CreateNode: Missing test for title-only validation

**Location:** `tests/unit/core/graphcore.test.ts:437-444`

**Problem:** Test "throws if title is missing" only tests `{ id: 'no-title.md', content: '' }`. Doesn't test empty string title `{ id: 'x.md', title: '', content: '' }` or whitespace-only title.

**Evidence:**
```typescript
// Current test
it('throws if title is missing', async () => {
  await expect(
    core.createNode({ id: 'no-title.md', content: '' })
  ).rejects.toThrow(/title/i);
});

// Missing: empty string title
// Implementation src/core/graphcore.ts:108-110
if (!partial.title) {  // Empty string is falsy, so this catches it
  throw new Error('Node title is required');
}
```

**Fix:** Add explicit tests for empty string and whitespace title to match the id validation tests (which do cover these cases at lines 410-435).

**Verification:** Run tests for `{ id: 'x.md', title: '', content: '' }` and `{ id: 'x.md', title: '   ', content: '' }`.

---

### [LOW] ResolveNodes: Semantic resolution with multiple queries has no assertion on batch ordering

**Location:** `tests/unit/core/graphcore.test.ts:759-779`

**Problem:** Semantic resolution test uses single query. No test verifies that batch queries return results in input order (parallel embedding could theoretically reorder).

**Evidence:**
```typescript
it('handles semantic strategy with embedding provider', async () => {
  // Only tests single query 'beef'
  const result = await core.resolveNodes(['beef'], { strategy: 'semantic' });
  expect(result).toHaveLength(1);
  // ...
});
```

**Fix:** Add test with multiple queries asserting order preservation:
```typescript
it('preserves query order in semantic batch resolution', async () => {
  // Setup embeddings for 'beef', 'chicken', 'pork'
  const result = await core.resolveNodes(['beef', 'chicken', 'pork'], { strategy: 'semantic' });
  expect(result[0]!.query).toBe('beef');
  expect(result[1]!.query).toBe('chicken');
  expect(result[2]!.query).toBe('pork');
});
```

**Verification:** Test passes confirming order is preserved.

---

### [LOW] FromConfig: No test for embedding provider not registered when config omits it

**Location:** `tests/unit/core/graphcore.test.ts:889-977`

**Problem:** The fromConfig tests verify embedding creation with custom model and unsupported type, but don't test the default case where embedding config is omitted and a local embedding provider is auto-registered. Test "uses default paths" at line 922-937 doesn't verify embedding was registered.

**Evidence:**
```typescript
it('uses default paths when source and cache not specified', () => {
  const config: RouxConfig = {
    providers: {
      store: { type: 'docstore' },
      // No embedding config - should auto-register local
    },
  };

  const core = GraphCoreImpl.fromConfig(config);
  expect(core).toBeDefined();
  // No assertion that search() works (would require embedding)
});
```

**Fix:** Add explicit test that omitting embedding config still registers a working embedding provider:
```typescript
it('auto-registers local embedding when embedding config omitted', async () => {
  const config: RouxConfig = {
    providers: { store: { type: 'docstore' } },
    // ...paths
  };
  const core = GraphCoreImpl.fromConfig(config);
  // This would throw "EmbeddingProvider not registered" if not auto-registered
  await expect(core.search('test')).resolves.toBeDefined();
});
```

**Verification:** Search operation succeeds with default embedding provider.

---

## Notes

Several archived issues show these areas were previously identified and fixed:
- Provider registration null/undefined: ARCHIVED (tests added at lines 92-110)
- Empty string ID validation: ARCHIVED (tests added at lines 410-435)  
- DeleteNode error swallowing: ARCHIVED (tests added at lines 498-526)
- Dimension mismatch: ARCHIVED (test added at lines 870-886)

The test file has grown organically with good coverage but would benefit from a pass ensuring all documented options (threshold, tags in SearchOptions) are either tested or removed.
