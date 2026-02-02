---
id: p68-neBUedvs
title: audit-docstore-cache-test
tags:
  - test-audit
  - docstore
  - issue
status: open
---
# Test Audit: docstore/cache.test.ts

**Consolidated into:** [[consolidated-boundary-conditions]], [[consolidated-weak-assertions]], [[consolidated-error-propagation-gaps]]

## Summary

The cache test file has good coverage of happy paths but lacks edge case validation, error path testing, and several implementation paths remain untested. Some tests make weak assertions that could pass incorrectly.

## Findings

### [HIGH] getStats() method completely untested

**Location:** `src/providers/docstore/cache.ts:336-355`

**Problem:** The `getStats()` method that returns `{ nodeCount, embeddingCount, edgeCount }` has zero test coverage. This method uses `SUM(in_degree)` to compute edge count, which could fail silently if the centrality table is empty or contains nulls.

**Evidence:**
```typescript
// cache.ts:336-355
getStats(): { nodeCount: number; embeddingCount: number; edgeCount: number } {
  // ... no tests for this method
  const edgeSum = this.db
    .prepare('SELECT SUM(in_degree) as total FROM centrality')
    .get() as { total: number | null };
  return {
    nodeCount: nodeCount.count,
    embeddingCount: embeddingCount.count,
    edgeCount: edgeSum.total ?? 0,  // null coalescing untested
  };
}
```

**Fix:** Add test suite for `getStats()`:
- Empty cache returns `{ nodeCount: 0, embeddingCount: 0, edgeCount: 0 }`
- With nodes but no embeddings/centrality
- With full data

**Verification:** Run `vitest --coverage` and confirm `getStats` has 100% line coverage.

---

### [HIGH] updateOutgoingLinks() method untested

**Location:** `src/providers/docstore/cache.ts:308-312`

**Problem:** The `updateOutgoingLinks(nodeId, links)` method has no tests. This is used to update links without full node replacement.

**Evidence:**
```typescript
// cache.ts:308-312
updateOutgoingLinks(nodeId: string, links: string[]): void {
  this.db
    .prepare('UPDATE nodes SET outgoing_links = ? WHERE id = ?')
    .run(JSON.stringify(links), nodeId);
}
```

**Fix:** Add tests:
- Updates existing node's links
- Calling on non-existent node (silent no-op vs error?)
- Empty links array
- Verify old links are replaced, not appended

**Verification:** Run `vitest --coverage` and confirm `updateOutgoingLinks` has full coverage.

---

### [MEDIUM] Case-insensitive path filter uses LIKE without COLLATE NOCASE

**Location:** `src/providers/docstore/cache.ts:271-273`, `tests/unit/docstore/cache.test.ts:559-566`

**Problem:** The test at line 559 asserts case-insensitive path matching works, but the implementation uses `LIKE ? || '%'` which is case-sensitive by default in SQLite unless COLLATE NOCASE is specified. The test passes because SQLite's default LIKE is case-insensitive for ASCII letters, but this is an implementation detail, not guaranteed behavior.

**Evidence:**
```typescript
// cache.ts:271-273
if (filter.path) {
  conditions.push("id LIKE ? || '%'");  // No COLLATE NOCASE
  params.push(filter.path);
}

// cache.test.ts:559-566
it('filters by path prefix case-insensitively', () => {
  const result = cache.listNodes({ path: 'Recipes/' });
  expect(result.nodes).toHaveLength(2);  // Passes by accident
});
```

**Fix:** Either:
1. Add explicit `COLLATE NOCASE` to SQL query
2. Or change test to document that case sensitivity depends on SQLite defaults

**Verification:** Test with non-ASCII characters in path to expose behavior.

---

### [MEDIUM] Duplicate ID handling in getNodes not tested

**Location:** `src/providers/docstore/cache.ts:134-155`, `tests/unit/docstore/cache.test.ts:154-181`

**Problem:** `getNodes(['a.md', 'a.md'])` is never tested. The implementation returns results in request order, but duplicates would cause duplicates in output.

**Evidence:**
```typescript
// cache.ts:148-154 - returns in requested order
for (const id of ids) {
  const node = nodeMap.get(id);
  if (node) result.push(node);  // duplicate ids -> duplicate results
}
```

**Fix:** Add test confirming behavior with duplicate IDs:
- `getNodes(['a.md', 'a.md'])` should return `[nodeA, nodeA]` or dedupe?

**Verification:** Test passes and behavior is documented.

---

### [MEDIUM] JSON.parse error handling untested

**Location:** `src/providers/docstore/cache.ts:367-382`

**Problem:** `rowToNode` parses JSON for tags, outgoingLinks, and properties. If database corruption occurs and these contain invalid JSON, `JSON.parse` throws. No test verifies this failure mode.

**Evidence:**
```typescript
// cache.ts:378-380
tags: JSON.parse(row.tags) as string[],
outgoingLinks: JSON.parse(row.outgoing_links) as string[],
properties: JSON.parse(row.properties) as Record<string, unknown>,
```

**Fix:** Consider:
1. Wrap in try-catch with graceful degradation
2. Or add test documenting that corrupted data throws

**Verification:** Insert malformed JSON directly via SQL, call `getNode`, observe behavior.

---

### [MEDIUM] Embedding with empty vector array untested

**Location:** `src/providers/docstore/cache.ts:314-316`, `tests/unit/docstore/cache.test.ts:394-451`

**Problem:** `storeEmbedding('a.md', [], 'model')` is never tested. An empty Float32Array buffer could cause issues on retrieval.

**Evidence:**
```typescript
// embeddings.ts:20
const buffer = Buffer.from(new Float32Array(vector).buffer);
// empty array -> 0-byte buffer

// embeddings.ts:42-46
const float32 = new Float32Array(
  row.vector.buffer,
  row.vector.byteOffset,
  row.vector.length / 4  // 0 / 4 = 0, but is this valid?
);
```

**Fix:** Add test:
- `storeEmbedding(nodeId, [], model)` and `getEmbedding(nodeId)` returns `{ vector: [], model }`

**Verification:** Test passes confirming empty vector round-trips correctly.

---

### [MEDIUM] Centrality with edge values (0, negative) untested

**Location:** `src/providers/docstore/cache.ts:322-330`, `tests/unit/docstore/cache.test.ts:454-481`

**Problem:** `storeCentrality` is only tested with positive values. Edge cases like `pagerank: 0`, `inDegree: 0`, or even negative values are untested.

**Evidence:**
```typescript
// Test only uses: storeCentrality('a.md', 0.85, 5, 3, now)
// and storeCentrality('a.md', 0.5, 1, 2, Date.now())
```

**Fix:** Add tests:
- `pagerank: 0` (valid for isolated nodes)
- `inDegree: 0, outDegree: 0` (orphan node)
- Verify retrieval accuracy at edge values

**Verification:** Tests pass and edge values round-trip correctly.

---

### [MEDIUM] listNodes ordering is undefined and not tested

**Location:** `src/providers/docstore/cache.ts:284`, `tests/unit/docstore/cache.test.ts:581-593`

**Problem:** `listNodes` has no `ORDER BY` clause, so pagination results are non-deterministic. The pagination test at line 581-593 assumes stable ordering but SQLite doesn't guarantee it.

**Evidence:**
```typescript
// cache.ts:284
const query = `SELECT id, title FROM nodes ${whereClause} LIMIT ? OFFSET ?`;
// No ORDER BY - order depends on internal storage

// cache.test.ts:585
expect(offset2.nodes[0]!.id).toBe(all.nodes[2]!.id);
// Assumes stable ordering that isn't guaranteed
```

**Fix:** Either:
1. Add `ORDER BY id` to the query for deterministic pagination
2. Or change test to not assert specific ordering

**Verification:** Run test 100 times; if it ever fails, ordering is non-deterministic.

---

### [LOW] resolveTitles with large input array untested

**Location:** `src/providers/docstore/cache.ts:226-239`

**Problem:** `resolveTitles` builds a SQL query with `IN (${placeholders})`. With thousands of IDs, this could hit SQLite's variable limit (default 999). No test verifies behavior with large arrays.

**Evidence:**
```typescript
// cache.ts:229-232
const placeholders = ids.map(() => '?').join(',');
const rows = this.db
  .prepare(`SELECT id, title FROM nodes WHERE id IN (${placeholders})`)
  .all(...ids) as Array<{ id: string; title: string }>;
```

**Fix:** Add test with >999 IDs to verify SQLite limit handling (or document the limit).

**Verification:** Test with 1000+ IDs either passes or throws documented error.

---

### [LOW] close() called twice behavior untested

**Location:** `src/providers/docstore/cache.ts:363-365`, `tests/unit/docstore/cache.test.ts:17-20`

**Problem:** `cache.close()` is called in `afterEach`, but double-close behavior is untested. better-sqlite3 throws if you close an already-closed database.

**Evidence:**
```typescript
// cache.ts:363-365
close(): void {
  this.db.close();  // Throws if already closed
}
```

**Fix:** Add test:
- Calling `close()` twice should throw or be idempotent (document which)

**Verification:** Test documents expected behavior.

---

### [LOW] searchByTags with single-element array vs string inconsistency

**Location:** `tests/unit/docstore/cache.test.ts:253-266`

**Problem:** Tests always use multi-tag arrays. Single tag like `searchByTags(['alpha'], 'any')` works but `searchByTags([''], 'any')` (empty string tag) is untested.

**Fix:** Add edge case test for empty string in tags array.

**Verification:** Test documents behavior with malformed input.

## Known Issues (already documented)

The following were already captured in `docs/issues/cache-test-gaps.md`:
- Fuzzy threshold boundary test
- Semantic strategy fallthrough
- SQL injection defensive test
- Private DB field access

## References

- Implementation: `src/providers/docstore/cache.ts`
- Test file: `tests/unit/docstore/cache.test.ts`
- Related: [[Cache Test Gaps]]
