---
title: audit-docstore-test
tags:
  - test-audit
  - docstore
---
# Test Audit: docstore.test.ts

**Consolidated into:** [[consolidated-empty-string-validation]], [[consolidated-boundary-conditions]], [[consolidated-weak-assertions]]

## Summary
Comprehensive audit of `tests/unit/docstore/docstore.test.ts` against `src/providers/docstore/index.ts`. Found 12 gaps ranging from missing edge cases to weak assertions and untested code paths. Tests are generally solid but lack coverage for error paths and boundary conditions.

## Findings

### [MEDIUM] hasEmbedding Method Not Tested
**Location:** `src/providers/docstore/index.ts:318-320`
**Problem:** The `hasEmbedding` method is implemented but has zero test coverage in docstore.test.ts.
**Evidence:**
```typescript
// Implementation exists at line 318-320
hasEmbedding(id: string): boolean {
  return this.vectorProvider.hasEmbedding(id);
}
```
No test in docstore.test.ts calls `store.hasEmbedding()`.
**Fix:** Add test block:
```typescript
describe('hasEmbedding', () => {
  it('returns false for node without embedding', async () => {
    await writeMarkdownFile('no-embedding.md', '# No embedding');
    await store.sync();
    expect(store.hasEmbedding('no-embedding.md')).toBe(false);
  });

  it('returns true after storeEmbedding', async () => {
    await store.storeEmbedding('test.md', [0.1, 0.2], 'model');
    expect(store.hasEmbedding('test.md')).toBe(true);
  });
});
```
**Verification:** Run `vitest --coverage` and check hasEmbedding is covered.

### [MEDIUM] getRandomNode Distribution Not Verified
**Location:** `tests/unit/docstore/docstore.test.ts:1308-1360`
**Problem:** Tests verify getRandomNode returns a valid node but don't verify it's actually random across multiple calls. Could always return first node and tests would pass.
**Evidence:**
```typescript
// Lines 1314-1322 - only calls once, any deterministic implementation passes
it('returns a node when store has nodes', async () => {
  await writeMarkdownFile('a.md', '---\ntitle: A\n---\nContent');
  await writeMarkdownFile('b.md', '---\ntitle: B\n---\nContent');
  await store.sync();

  const result = await store.getRandomNode();
  expect(result).not.toBeNull();
  expect(['a.md', 'b.md']).toContain(result?.id);
});
```
**Fix:** Add statistical distribution test:
```typescript
it('returns different nodes over multiple calls (probabilistic)', async () => {
  await writeMarkdownFile('a.md', '# A');
  await writeMarkdownFile('b.md', '# B');
  await writeMarkdownFile('c.md', '# C');
  await store.sync();

  const results = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const node = await store.getRandomNode();
    if (node) results.add(node.id);
  }
  // With 50 calls and 3 nodes, expect at least 2 different results
  expect(results.size).toBeGreaterThan(1);
});
```
**Verification:** Test should pass with random implementation, fail if always returns same node.

### [MEDIUM] startWatching Error Path Missing
**Location:** `src/providers/docstore/index.ts:330-346`
**Problem:** `startWatching` throws if already watching (line 331-333), but no test verifies this error behavior.
**Evidence:**
```typescript
// Implementation throws but no test
if (this.fileWatcher?.isWatching()) {
  throw new Error('Already watching. Call stopWatching() first.');
}
```
No test in docstore.test.ts calls `startWatching` twice.
**Fix:** Add test in file watcher section (or create new section):
```typescript
describe('file watching', () => {
  it('throws if startWatching called while already watching', async () => {
    await store.startWatching();
    await expect(store.startWatching()).rejects.toThrow(/already watching/i);
    store.stopWatching();
  });
});
```
**Verification:** Test should pass with current implementation.

### [LOW] isWatching Method Not Tested
**Location:** `src/providers/docstore/index.ts:354-356`
**Problem:** The `isWatching` method exists but has no direct test coverage.
**Evidence:**
```typescript
isWatching(): boolean {
  return this.fileWatcher?.isWatching() ?? false;
}
```
**Fix:** Add assertion to file watching tests:
```typescript
it('isWatching returns correct state', async () => {
  expect(store.isWatching()).toBe(false);
  await store.startWatching();
  expect(store.isWatching()).toBe(true);
  store.stopWatching();
  expect(store.isWatching()).toBe(false);
});
```
**Verification:** Method should be covered after adding test.

### [MEDIUM] handleWatcherBatch Error Handling Partially Covered
**Location:** `src/providers/docstore/index.ts:358-394`
**Problem:** The watcher batch handler catches errors and logs them (line 378-380), but the only test is via ENOENT mocking. No test for general parse/read errors during watch mode.
**Evidence:**
```typescript
// Line 378-380 - error path only tested via mocking in sync() tests
} catch (err) {
  console.warn(`Failed to process file change for ${id}:`, err);
}
```
Tests at lines 958-1032 mock `getFileMtime` but don't exercise the watcher callback error path.
**Fix:** Add integration test with FormatReader that throws during watch:
```typescript
it('continues processing when one file change fails', async () => {
  // This requires either:
  // 1. Direct unit test of handleWatcherBatch with injected events
  // 2. Or triggering real file system changes with a bad file
});
```
**Verification:** Coverage report should show handleWatcherBatch catch block covered.

### [HIGH] updateNode with Empty String Content Not Tested
**Location:** `src/providers/docstore/index.ts:153-192`
**Problem:** No test verifies behavior when updating a node with empty string content (`{ content: '' }`). This affects wiki-link reparsing since empty content should produce empty outgoingLinks.
**Evidence:**
```typescript
// Lines 161-165 - content check uses !== undefined
if (updates.content !== undefined && outgoingLinks === undefined) {
  const rawLinks = extractWikiLinks(updates.content);
  outgoingLinks = rawLinks.map((link) => normalizeWikiLink(link));
}
```
**Fix:**
```typescript
it('handles empty content update', async () => {
  await writeMarkdownFile('has-content.md', '---\ntitle: Has\n---\n[[some-link]]');
  await store.sync();
  
  let node = await store.getNode('has-content.md');
  expect(node?.outgoingLinks.length).toBeGreaterThan(0);
  
  await store.updateNode('has-content.md', { content: '' });
  
  node = await store.getNode('has-content.md');
  expect(node?.content).toBe('');
  expect(node?.outgoingLinks).toEqual([]);
});
```
**Verification:** Test passes and empty content properly clears outgoingLinks.

### [MEDIUM] createNode with Properties Containing Special Characters
**Location:** `tests/unit/docstore/docstore.test.ts:223-291`
**Problem:** createNode tests don't verify YAML serialization of properties with special characters, quotes, or nested objects that might break frontmatter parsing.
**Evidence:**
```typescript
// Line 233 - simple property only
properties: { custom: 'prop' },
```
**Fix:**
```typescript
it('handles properties with special YAML characters', async () => {
  const node: Node = {
    id: 'special-props.md',
    title: 'Special',
    content: 'Content',
    tags: [],
    outgoingLinks: [],
    properties: {
      'key: with colon': 'value',
      quote: 'has "quotes" inside',
      multiline: 'line1\nline2',
      nested: { deep: 'value' },
    },
  };

  await store.createNode(node);
  const retrieved = await store.getNode('special-props.md');

  expect(retrieved?.properties['key: with colon']).toBe('value');
  expect(retrieved?.properties['quote']).toBe('has "quotes" inside');
});
```
**Verification:** Round-trip of special properties works correctly.

### [LOW] listNodes Ordering Not Asserted
**Location:** `tests/unit/docstore/docstore.test.ts:1169-1218`
**Problem:** listNodes tests verify filtering works but don't assert any specific ordering. If implementation changes ordering, tests still pass.
**Evidence:**
```typescript
// Lines 1186-1191 - length check only, no order verification
it('filters by tag', async () => {
  const result = await store.listNodes({ tag: 'recipe' });
  expect(result.nodes).toHaveLength(2);
  expect(result.total).toBe(2);
  expect(result.nodes.every(n => n.id.startsWith('recipes/'))).toBe(true);
});
```
**Fix:** Either document ordering is undefined, or add explicit order test:
```typescript
it('returns nodes in consistent order', async () => {
  // Call twice, verify same order
  const first = await store.listNodes({});
  const second = await store.listNodes({});
  expect(first.nodes.map(n => n.id)).toEqual(second.nodes.map(n => n.id));
});
```
**Verification:** Ordering behavior is documented and tested.

### [MEDIUM] resolveNodes Threshold Edge Case
**Location:** `tests/unit/docstore/docstore.test.ts:1221-1269`
**Problem:** resolveNodes tests use default threshold (0.7) but don't test threshold boundary cases (exactly 0.7 score, 0.0, 1.0).
**Evidence:**
```typescript
// Line 1249 - custom threshold used but not boundary tested
const result = await store.resolveNodes(['beef'], { tag: 'recipe', strategy: 'fuzzy', threshold: 0.3 });
```
**Fix:**
```typescript
it('returns no match when score equals threshold (exclusive)', async () => {
  // Create node where fuzzy match produces exactly threshold score
  // Verify behavior at boundary
});

it('accepts threshold of 0 (matches everything)', async () => {
  const result = await store.resolveNodes(['xyz'], { strategy: 'fuzzy', threshold: 0 });
  expect(result[0]!.match).not.toBeNull(); // Should match something
});

it('accepts threshold of 1 (exact only)', async () => {
  const result = await store.resolveNodes(['ground'], { strategy: 'fuzzy', threshold: 1 });
  expect(result[0]!.match).toBeNull(); // "ground" != "ground beef"
});
```
**Verification:** Threshold boundary behavior is explicit.

### [LOW] Security Test Doesn't Check updateNode Path
**Location:** `tests/unit/docstore/docstore.test.ts:808-836`
**Problem:** Security tests verify createNode rejects path traversal but don't verify updateNode can't be exploited.
**Evidence:**
```typescript
// Only createNode tested for path traversal
```

**Fix:** Add updateNode security test.

**Verification:** updateNode path traversal is blocked.
