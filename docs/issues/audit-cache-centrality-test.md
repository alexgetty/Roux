---
tags:
  - test-audit
  - docstore
  - cache
status: open
title: audit-cache-centrality-test
---

# Test Audit: cache/centrality.test.ts

## Summary

The centrality cache tests cover basic happy paths but miss critical edge cases including foreign key violations, boundary values, SQL injection, and incomplete assertions on the upsert test.

## Findings

### [HIGH] Foreign Key Violation Behavior Untested

**Location:** `tests/unit/docstore/cache/centrality.test.ts` - missing test
**Problem:** The schema defines `FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE` and `foreign_keys = ON` is set, but no test verifies what happens when storing centrality for a non-existent node ID. The implementation will throw a SQLite constraint error, but this behavior is undocumented by tests.
**Evidence:**
```typescript
// Setup only inserts 'test.md' into nodes table
db.prepare('INSERT INTO nodes (id) VALUES (?)').run('test.md');

// No test exists for:
storeCentrality(db, 'nonexistent-node.md', 0.5, 1, 1, Date.now());
```
**Fix:** Add test case in `storeCentrality` describe block:
```typescript
it('throws on foreign key violation for non-existent node', () => {
  expect(() => storeCentrality(db, 'no-such-node.md', 0.5, 1, 1, Date.now()))
    .toThrow(); // Or toThrow(/FOREIGN KEY constraint failed/)
});
```
**Verification:** Test should fail initially (red), then pass after confirming implementation throws.

### [HIGH] Upsert Test Has Incomplete Assertions

**Location:** `tests/unit/docstore/cache/centrality.test.ts:52-68`
**Problem:** The "overwrites existing centrality on conflict" test only verifies `pagerank` and `computed_at` were updated, but doesn't check that `in_degree` and `out_degree` were also properly overwritten. If the upsert SQL missed those columns, this test would still pass.
**Evidence:**
```typescript
it('overwrites existing centrality on conflict', () => {
  storeCentrality(db, 'test.md', 0.5, 1, 2, 1000);
  storeCentrality(db, 'test.md', 0.9, 10, 20, 2000);

  // ... count assertion ...

  const row = db
    .prepare('SELECT pagerank, computed_at FROM centrality WHERE node_id = ?')
    .get('test.md') as { pagerank: number; computed_at: number };

  expect(row.pagerank).toBe(0.9);
  expect(row.computed_at).toBe(2000);
  // MISSING: assertions for in_degree and out_degree
});
```
**Fix:** Expand the SELECT to include all columns and add assertions:
```typescript
const row = db
  .prepare('SELECT pagerank, in_degree, out_degree, computed_at FROM centrality WHERE node_id = ?')
  .get('test.md') as { pagerank: number; in_degree: number; out_degree: number; computed_at: number };

expect(row.pagerank).toBe(0.9);
expect(row.in_degree).toBe(10);
expect(row.out_degree).toBe(20);
expect(row.computed_at).toBe(2000);
```
**Verification:** Temporarily break the upsert SQL by removing `in_degree = excluded.in_degree` - the updated test should catch it.

### [MEDIUM] Boundary Values Untested

**Location:** `tests/unit/docstore/cache/centrality.test.ts` - missing tests
**Problem:** No tests for edge case values:
- Zero pagerank (0.0)
- Pagerank at boundaries (0.0, 1.0)
- Zero degree counts
- Large integers for degree counts
- Floating point precision for pagerank

**Evidence:** All tests use arbitrary mid-range values like `0.85`, `5`, `3`, etc.
**Fix:** Add boundary test cases:
```typescript
it('handles zero values', () => {
  storeCentrality(db, 'test.md', 0.0, 0, 0, 0);
  const result = getCentrality(db, 'test.md');
  expect(result?.pagerank).toBe(0.0);
  expect(result?.inDegree).toBe(0);
  expect(result?.outDegree).toBe(0);
});

it('handles large degree counts', () => {
  storeCentrality(db, 'test.md', 0.5, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Date.now());
  const result = getCentrality(db, 'test.md');
  expect(result?.inDegree).toBe(Number.MAX_SAFE_INTEGER);
});
```
**Verification:** Tests pass, confirming implementation handles boundaries correctly.

### [MEDIUM] SQL Injection Not Explicitly Tested

**Location:** `tests/unit/docstore/cache/centrality.test.ts` - missing test
**Problem:** While parameterized queries are used (safe), there's no defensive test documenting that special characters in node IDs are handled safely.
**Evidence:**
```typescript
// Implementation uses parameterized queries (good):
.run(nodeId, pagerank, inDegree, outDegree, computedAt);

// But no test confirms safety with malicious input
```
**Fix:** Add defensive documentation test:
```typescript
it('handles special characters in node ID safely', () => {
  const maliciousId = "'; DROP TABLE centrality; --";
  db.prepare('INSERT INTO nodes (id) VALUES (?)').run(maliciousId);
  
  // Should not throw or corrupt data
  expect(() => storeCentrality(db, maliciousId, 0.5, 1, 1, Date.now())).not.toThrow();
  expect(getCentrality(db, maliciousId)).not.toBeNull();
});
```
**Verification:** Test passes, documenting that parameterized queries protect against injection.

### [LOW] Type Assertions Bypass Runtime Validation

**Location:** `tests/unit/docstore/cache/centrality.test.ts:39-44, 58, 64`
**Problem:** Tests use TypeScript `as` casts to assume returned row shapes. If the implementation returned incorrect structure, the tests would fail with confusing runtime errors rather than clear assertion failures.
**Evidence:**
```typescript
const row = db
  .prepare('SELECT * FROM centrality WHERE node_id = ?')
  .get('test.md') as {
    pagerank: number;
    in_degree: number;
    out_degree: number;
    computed_at: number;
  };
```
**Fix:** Either validate structure explicitly or use a helper function:
```typescript
const row = db.prepare('SELECT * FROM centrality WHERE node_id = ?').get('test.md');
expect(row).toBeDefined();
expect(row).toHaveProperty('pagerank');
expect(row).toHaveProperty('in_degree');
// ... then use the values
```
**Verification:** Temporarily change a column name in implementation - clearer error messages will confirm fix worked.

### [LOW] getCentrality Tests Don't Exercise Multiple Nodes

**Location:** `tests/unit/docstore/cache/centrality.test.ts:71-94`
**Problem:** All `getCentrality` tests operate on a single node ID. No test confirms that getting centrality for one node doesn't accidentally return another node's data.
**Evidence:** All tests use only `'test.md'` or `'nonexistent.md'`.
**Fix:** Add multi-node test:
```typescript
it('returns correct centrality for specific node among many', () => {
  db.prepare('INSERT INTO nodes (id) VALUES (?)').run('other.md');
  storeCentrality(db, 'test.md', 0.5, 1, 2, 1000);
  storeCentrality(db, 'other.md', 0.9, 9, 8, 2000);
  
  const result = getCentrality(db, 'test.md');
  expect(result?.pagerank).toBe(0.5); // Not 0.9 from other.md
});
```
**Verification:** Test passes, confirming proper WHERE clause isolation.

## References

- [[Cache]]
- [[TDD]]
- Related: [[cache-test-gaps]] (general cache test gaps, does not cover centrality)
