---
title: audit-graphcore-integration-test
tags:
  - test-audit
  - integration
  - core
status: open
---
# Test Audit: graphcore.integration.test.ts

**Consolidated into:** [[consolidated-weak-assertions]], [[consolidated-boundary-conditions]], [[consolidated-error-propagation-gaps]]

## Summary

The GraphCore integration test provides good coverage of the happy path but has significant gaps in error handling, edge cases, and untested interface options. Several tests make weak assertions that could pass accidentally, and the resource management issue (DocStore leak in fromConfig test) is already documented but still present.

## Findings

### [HIGH] SearchOptions.threshold and SearchOptions.tags are untested

**Location:** `tests/integration/core/graphcore.integration.test.ts:55-136`

**Problem:** The `SearchOptions` interface declares `threshold` and `tags` options (see `src/types/graphcore.ts:15-21`), but no integration test exercises them.

```typescript
// src/types/graphcore.ts:15-21
export interface SearchOptions {
  /** Default: 10 */
  limit?: number;
  /** 0-1 */
  threshold?: number;
  tags?: string[];
}
```

The tests only cover `limit`:
```typescript
// line 133 - only limit is tested
const results = await core.search('programming', { limit: 2 });
```

**Evidence:** Grep for `threshold` in the integration test file returns zero matches. Same for `tags` within the search flow describe block.

**Fix:** Add tests for:
1. `search(query, { threshold: 0.8 })` - verify low-similarity results are filtered out
2. `search(query, { tags: ['ai'] })` - verify results are pre-filtered by tags

**Verification:** Tests should fail if implementation ignores these options.

---

### [HIGH] Semantic ranking test has weak assertion

**Location:** `tests/integration/core/graphcore.integration.test.ts:79-111`

**Problem:** The test "ranks semantically similar content higher" uses a probabilistic assertion that could pass even if ranking is broken:

```typescript
// line 108-110
expect(results.length).toBeGreaterThan(0);
// Deep learning should rank highest for AI query
expect(results[0]!.id).toBe('deep-learning.md');
```

The comment says "should" but if the embedding model changes or produces different vectors, this test could fail intermittently or pass when broken.

**Evidence:** No assertion that `deep-learning.md` scored higher than `cooking.md` or `gardening.md`. The test passes if `deep-learning.md` appears first, but doesn't validate the relative ordering was correct.

**Fix:** 
1. Assert all three nodes are returned and check full ordering
2. Or assert similarity scores are monotonically decreasing
3. Or use a deterministic mock for the embedding (but this is integration test, so real embedding makes sense)

**Verification:** Intentionally break the ranking (e.g., return nodes in random order) and confirm test fails.

---

### [MEDIUM] getNode with invalid depth values untested

**Location:** `tests/integration/core/graphcore.integration.test.ts:255-262`

**Problem:** Only `depth=1` is tested. No tests for:
- `depth=0` (explicit zero)
- `depth=-1` (negative)
- `depth=2` (unsupported per MCP schema max=1)
- `depth=undefined` (default behavior)

```typescript
// line 255-262 - only depth=1 tested
it('getNode with depth=1 includes neighbor context', async () => {
  const nodeWithContext = await core.getNode('node-a.md', 1);
  // ...
});
```

**Evidence:** The unit tests cover `depth=0` and `depth=undefined` with mocks, but integration tests don't verify real behavior.

**Fix:** Add integration tests for:
- `getNode(id, 0)` should return node without neighbors
- `getNode(id)` with no depth arg should return node without neighbors
- Consider what happens with `depth > 1` - should it clamp or error?

**Verification:** Each test should assert correct presence/absence of `neighbors`, `incomingCount`, `outgoingCount`.

---

### [MEDIUM] No test for creating node with duplicate ID

**Location:** `tests/integration/core/graphcore.integration.test.ts:164-184`

**Problem:** The CRUD test creates a new node but doesn't test what happens if a node with that ID already exists:

```typescript
// line 167-173
const created = await core.createNode({
  id: 'new-note.md',
  title: 'New Note',
  content: 'Content about quantum computing and qubits.',
  tags: ['physics', 'computing'],
});
```

**Evidence:** No test for `createNode` with an ID that already exists in the store.

**Fix:** Add test that:
1. Creates a node
2. Attempts to create another node with the same ID
3. Verifies the expected behavior (error? overwrite? merge?)

**Verification:** Test should document and enforce the contract for duplicate ID handling.

---

### [MEDIUM] No error handling tests for store operations

**Location:** Throughout `tests/integration/core/graphcore.integration.test.ts`

**Problem:** All tests are happy-path. No integration tests for:
- `getNode` on non-existent ID (returns null but not tested in integration)
- `updateNode` on non-existent ID
- `deleteNode` on non-existent ID
- File system errors during write operations

**Evidence:** Search for "rejects" or "throw" in the integration test file - no error path tests.

**Fix:** Add error scenario tests:
```typescript
it('getNode returns null for non-existent node', async () => {
  const result = await core.getNode('does-not-exist.md');
  expect(result).toBeNull();
});

it('deleteNode returns false for non-existent node', async () => {
  const result = await core.deleteNode('does-not-exist.md');
  expect(result).toBe(false);
});
```

**Verification:** These tests verify the integration between GraphCore and DocStore error handling works correctly.

---

### [MEDIUM] listNodes and resolveNodes methods are completely untested

**Location:** `src/core/graphcore.ts:182-257`

**Problem:** The `GraphCore` interface includes `listNodes` and `resolveNodes` methods that have unit test coverage but zero integration test coverage.

```typescript
// src/core/graphcore.ts - these methods exist but aren't integration tested
async listNodes(filter: ListFilter, options?: ListOptions): Promise<ListNodesResult>
async resolveNodes(names: string[], options?: ResolveOptions): Promise<ResolveResult[]>
```

**Evidence:** Grep for `listNodes` and `resolveNodes` in the integration test file returns zero matches.

**Fix:** Add integration tests for:
1. `listNodes` with path filter
2. `listNodes` with tag filter  
3. `listNodes` with pagination (offset/limit)
4. `resolveNodes` with exact strategy
5. `resolveNodes` with fuzzy strategy
6. `resolveNodes` with semantic strategy (uses real embedding provider)

**Verification:** Each method should have at least one integration test demonstrating real provider interaction.

---

### [MEDIUM] fromConfig test creates orphaned DocStore (DUPLICATE)

**Location:** `tests/integration/core/graphcore.integration.test.ts:335-367`

**Problem:** Already documented in `docs/issues/GraphCore Integration Test DocStore Leak.md`. The configured GraphCore's internal DocStore is never closed.

**Evidence:** See existing issue file.

**Fix:** See existing issue file recommendations.

**Verification:** See existing issue file.

---

### [LOW] Tag operations test relies on single-node match for randomness

**Location:** `tests/integration/core/graphcore.integration.test.ts:328-332`

**Problem:** The `getRandomNode` test only works because there's exactly one node with the `gamma` tag:

```typescript
// line 328-332
it('getRandomNode with tag filter returns matching node', async () => {
  const node = await core.getRandomNode(['gamma']);
  expect(node).not.toBeNull();
  expect(node!.id).toBe('tagged-b.md'); // Only one has gamma tag
});
```

**Evidence:** The comment "Only one has gamma tag" reveals this isn't testing randomness, just that filtering works.

**Fix:** Either:
1. Add multiple nodes with the `gamma` tag and run the test multiple times to verify randomness
2. Or rename the test to clarify it's testing tag filtering, not randomness

**Verification:** If testing randomness, multiple runs should occasionally return different nodes.

---

### [LOW] No test for searchByTags with empty tags array

**Location:** `tests/integration/core/graphcore.integration.test.ts:316-326`

**Problem:** Tests cover `searchByTags(['alpha'])` and `searchByTags(['alpha', 'beta'])` but not edge case of empty array.

```typescript
// What happens with empty tags?
const results = await core.searchByTags([], 'any');
```

**Evidence:** No test for empty tags array.

**Fix:** Add test clarifying expected behavior for empty tags (should return all nodes? empty array? error?).

**Verification:** Test should enforce and document the contract.

---

### [LOW] No test for getHubs with out_degree metric

**Location:** `tests/integration/core/graphcore.integration.test.ts:289-296`

**Problem:** Only `in_degree` metric is tested:

```typescript
// line 289-296 - only in_degree
it('getHubs returns most connected nodes', async () => {
  const hubs = await core.getHubs('in_degree', 3);
  // ...
});
```

**Evidence:** The `Metric` type allows `'in_degree' | 'out_degree'` but only one is integration tested.

**Fix:** Add test for `getHubs('out_degree', 3)` which should return `node-a.md` (has 2 outgoing links).

**Verification:** Test should verify `out_degree` metric produces different ranking than `in_degree`.

---

### [LOW] Embedding model warmup in beforeAll may hide initialization errors

**Location:** `tests/integration/core/graphcore.integration.test.ts:17-22`

**Problem:** Model warmup happens in `beforeAll` which runs once:

```typescript
// line 17-22
beforeAll(async () => {
  embedding = new TransformersEmbeddingProvider();
  await embedding.embed('warmup');
}, 60000);
```

If the embedding provider fails to initialize, all tests will fail with potentially confusing errors rather than a clear "embedding provider initialization failed" message.

**Evidence:** No try/catch or explicit error handling in warmup.

**Fix:** Wrap warmup in try/catch with descriptive error message, or add explicit initialization test first.

**Verification:** Introduce artificial embedding provider failure and verify error message is clear.

---

## Missing Coverage Summary

| Category | Gap |
|----------|-----|
| Search | threshold, tags options |
| getNode | depth edge cases |
| createNode | duplicate ID handling |
| CRUD | error paths |
| listNodes | entire method |
| resolveNodes | entire method |
| getHubs | out_degree metric |
| searchByTags | empty array |
