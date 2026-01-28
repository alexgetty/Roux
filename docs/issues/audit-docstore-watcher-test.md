---
tags:
  - test-audit
  - docstore
status: open
title: audit-docstore-watcher-test
---

# Test Audit: watcher.test.ts

## Summary

The watcher integration tests provide reasonable coverage of the happy path but have weak assertions, missing edge cases for error handling, and incomplete verification of cache state after operations.

## Findings

### [HIGH] Missing Cache State Verification After Node Updates

**Location:** `tests/unit/docstore/watcher.test.ts:241-257`

**Problem:** The "upserts node on change event" test only verifies the title changed but doesn't verify content was updated or other node properties are correct.

**Evidence:**
```typescript
it('upserts node on change event', async () => {
  await writeMarkdownFile('existing.md', '---\ntitle: Original\n---\nContent');
  await store.sync();
  await writeMarkdownFile('existing.md', '---\ntitle: Updated\n---\nNew content');

  store.startWatching();
  triggerEvent('change', join(sourceDir, 'existing.md'));

  await vi.waitFor(
    async () => {
      const node = await store.getNode('existing.md');
      expect(node?.title).toBe('Updated');
    },
    { timeout: 2000 }
  );
});
```

**Fix:** Assert that `node.content` equals `'New content'` to verify the full update propagated.

**Verification:** Run test with an intentional bug that updates title but not content - should fail.

---

### [HIGH] unlink on Non-Existent Node Not Tested

**Location:** `tests/unit/docstore/watcher.test.ts:259-274`

**Problem:** The "deletes node on unlink event" test only tests deleting a node that exists in cache. The implementation at `index.ts:364-369` has a guard `if (existing)` but this branch isn't tested when `existing` is falsy.

**Evidence:**
Implementation check:
```typescript
if (event === 'unlink') {
  const existing = this.cache.getNode(id);
  if (existing) {  // <-- What if existing is null?
    this.cache.deleteNode(id);
    await this.vectorProvider.delete(id);
    processedIds.push(id);
  }
}
```

**Fix:** Add test:
```typescript
it('ignores unlink for non-existent node', async () => {
  const onChange = vi.fn();
  store.startWatching(onChange);

  // File never existed in cache
  triggerEvent('unlink', join(sourceDir, 'never-existed.md'));

  await new Promise((r) => setTimeout(r, 100));
  // onChange should NOT include this ID
  expect(onChange).not.toHaveBeenCalled();
});
```

**Verification:** Remove the `if (existing)` guard - test should fail.

---

### [MEDIUM] onChange Callback Receives Incomplete ID List on Partial Failure

**Location:** `tests/unit/docstore/watcher.test.ts:195-219`

**Problem:** "continues processing batch after individual file error" test only checks that `onChange` was called, but doesn't verify which IDs were passed. If `b-missing.md` fails, does `onChange` receive `['a.md', 'c.md']` (without the failed one)?

**Evidence:**
```typescript
await vi.waitFor(
  () => {
    expect(onChange).toHaveBeenCalled();  // <-- Too weak
  },
  { timeout: 2000 }
);
```

**Fix:** Assert specific IDs:
```typescript
expect(onChange).toHaveBeenCalledWith(
  expect.arrayContaining(['a.md', 'c.md'])
);
expect(onChange).toHaveBeenCalledWith(
  expect.not.arrayContaining(['b-missing.md'])
);
```

**Verification:** Modify implementation to include failed IDs in callback - test should fail.

---

### [MEDIUM] vectorProvider.delete() Failure Not Tested

**Location:** `tests/unit/docstore/watcher.test.ts:320-364`

**Problem:** The embedding deletion tests use mocks that always succeed. No test verifies behavior when `vectorProvider.delete()` throws.

**Evidence:**
The mock at line 329:
```typescript
delete: vi.fn().mockImplementation(async (id: string) => {
  embeddingState.delete(id);  // Always succeeds
}),
```

Implementation at `index.ts:367`:
```typescript
await this.vectorProvider.delete(id);
```

If this throws, what happens? Is the error caught? Is the node still removed from cache?

**Fix:** Add test:
```typescript
it('continues with node deletion even if vector delete fails', async () => {
  const mockVector = {
    delete: vi.fn().mockRejectedValue(new Error('Vector store unavailable')),
    // ... other mocks
  };
  const customStore = new DocStore(sourceDir, customCacheDir, mockVector);
  await writeMarkdownFile('vec-fail.md', '# Content');
  await customStore.sync();
  
  customStore.startWatching();
  triggerEvent('unlink', join(sourceDir, 'vec-fail.md'));
  
  await vi.waitFor(async () => {
    // Node should still be removed even if vector delete fails
    expect(await customStore.getNode('vec-fail.md')).toBeNull();
  });
});
```

**Verification:** Change implementation to throw when vector delete fails - test documents expected behavior.

---

### [MEDIUM] Graph Rebuild Not Asserted for unlink Events

**Location:** `tests/unit/docstore/watcher.test.ts:276-297`

**Problem:** "rebuilds graph after processing queue" only tests add. There's no equivalent test for unlink - when a linked node is deleted, do backlinks get cleaned up?

**Evidence:**
```typescript
it('rebuilds graph after processing queue', async () => {
  await writeMarkdownFile('a.md', '---\ntitle: A\n---\nLinks to [[b]]');
  await store.sync();
  await writeMarkdownFile('b.md', '---\ntitle: B\n---\nContent');

  store.startWatching();
  triggerEvent('add', join(sourceDir, 'b.md'));  // Only tests add
  // ... no test for unlink
```

**Fix:** Add test:
```typescript
it('cleans up backlinks when linked node is deleted', async () => {
  await writeMarkdownFile('linker.md', 'Links to [[target]]');
  await writeMarkdownFile('target.md', '# Target');
  await store.sync();

  // Verify link exists
  const incoming = await store.getNeighbors('target.md', { direction: 'in' });
  expect(incoming.map(n => n.id)).toContain('linker.md');

  store.startWatching();
  triggerEvent('unlink', join(sourceDir, 'target.md'));

  await vi.waitFor(async () => {
    // linker.md should have no outgoing neighbors (target is gone)
    const outgoing = await store.getNeighbors('linker.md', { direction: 'out' });
    expect(outgoing).toHaveLength(0);
  });
});
```

**Verification:** Comment out `this.graphManager.build()` for unlink path - test should fail.

---

### [MEDIUM] parseFile Failure Doesn't Remove Stale Cache Entry

**Location:** `tests/unit/docstore/watcher.test.ts:165-193`

**Problem:** When a file change event triggers `parseFile()` and it fails, the old node remains in cache. The test verifies a warning is logged, but doesn't verify cache state.

**Evidence:**
If `existing.md` is in cache and then modified to be unparseable, the old cached version persists. This is probably intended (graceful degradation) but should be explicitly tested.

**Fix:** Add test:
```typescript
it('preserves cached node when parse fails on change event', async () => {
  await writeMarkdownFile('fragile.md', '---\ntitle: Original\n---\nContent');
  await store.sync();
  
  // Simulate file becoming corrupt (watcher won't know, just sees 'change')
  // For this we need to mock parseFile or make the file actually unparseable
  
  store.startWatching();
  triggerEvent('change', join(sourceDir, 'fragile.md')); // but file doesn't exist
  
  await new Promise(r => setTimeout(r, 100));
  
  // Old cached version should still be there
  const node = await store.getNode('fragile.md');
  expect(node?.title).toBe('Original');
});
```

**Verification:** The implementation's try/catch continues on error - verify cache remains intact.

---

### [LOW] No Test for Centrality Storage After Watcher Events

**Location:** `tests/unit/docstore/watcher.test.ts:276-297`

**Problem:** Implementation calls `this.storeCentrality(centrality)` at line 387 but no test verifies centrality scores are actually updated/stored.

**Evidence:**
```typescript
if (processedIds.length > 0) {
  this.resolveAllLinks();
  const centrality = this.graphManager.build(this.cache.getAllNodes());
  this.storeCentrality(centrality);  // <-- Untested
}
```

**Fix:** Add a test that checks node.centrality values are updated after watcher events.

**Verification:** Comment out `storeCentrality` call - behavior test should detect missing centrality.

---

### [LOW] Empty extensions Set Behavior With DocStore

**Location:** Not tested

**Problem:** `file-watcher.test.ts:324-338` tests that FileWatcher with empty extensions skips all files. But `watcher.test.ts` never tests what happens when DocStore is configured with a registry that returns no extensions.

**Fix:** Add edge case test or document that registry must return at least one extension.

**Verification:** N/A - documentation/defensive coding issue.

---

## Previously Documented Issues (Not Duplicated)

The following gaps are already tracked in existing issues:
- Wiki-link resolution for nested paths: `docs/issues/Watcher Wiki-Link Resolution Test Gap.md` (but a test was added at line 299-318, so may be resolved)
- Cache state assertions for coalescing: `docs/issues/watcher-event-coalescing-cache-state-assertions.md`
- Windows path handling: `docs/issues/filewatcher-windows-path-not-tested.md`

## References

- Implementation: `src/providers/docstore/index.ts:358-394`
- FileWatcher: `src/providers/docstore/watcher.ts`
- Unit test: `tests/unit/docstore/watcher.test.ts`
- Lower-level FileWatcher tests: `tests/unit/docstore/file-watcher.test.ts`
