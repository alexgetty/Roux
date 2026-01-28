---
tags:
  - test-audit
  - integration
  - watcher
status: open
title: audit-watcher-file-events-test
---

# Test Audit: file-events.test.ts

## Summary

Integration tests for the file watcher cover basic CRUD scenarios but have gaps in edge case coverage, weak assertions on intermediate state, and rely heavily on timing that could produce false positives.

## Findings

### [HIGH] Timing-based test assertions can pass by accident

**Location:** `tests/integration/watcher/file-events.test.ts:136-173`

**Problem:** The "batches rapid edits within debounce window" test uses fixed delays (`100ms`, `1500ms`) and weak bounds (`1 <= allChanges.length <= 3`). This accepts a wide range of behaviors - the test passes whether 1, 2, or 3 batches fire. A regression that always fires 3 batches would not be caught.

**Evidence:**
```typescript
// Rapid edits within debounce window
await writeMarkdownFile('rapid.md', '---\ntitle: V2\n---\nContent');
await new Promise((r) => setTimeout(r, 100));
await writeMarkdownFile('rapid.md', '---\ntitle: V3\n---\nContent');
await new Promise((r) => setTimeout(r, 100));
await writeMarkdownFile('rapid.md', '---\ntitle: V4\n---\nContent');

// Wait for at least one batch to process
await firstChangePromise;

// Wait a bit more to let any additional batches complete
await new Promise((r) => setTimeout(r, 1500));

// Batching should limit calls - at most 3 (one per debounce window reset)
expect(allChanges.length).toBeGreaterThanOrEqual(1);
expect(allChanges.length).toBeLessThanOrEqual(3);
```

**Fix:** Either:
1. Use `flush()` to get deterministic behavior and assert exact batch count
2. Assert specific callback content, not just count ranges
3. Document expected debounce window (1000ms default) and derive timing from that

**Verification:** Introduce a bug that fires one batch per event - test should fail but currently passes.

---

### [HIGH] No test for link removal updating the graph

**Location:** `tests/integration/watcher/file-events.test.ts:198-216` (known issue - see `docs/issues/watcher-test-gaps.md`)

**Problem:** Test verifies adding a link updates graph edges. No test verifies that REMOVING a link also updates the graph.

**Evidence:**
```typescript
it('updates graph edges when links change', async () => {
  await writeMarkdownFile('source.md', '---\ntitle: Source\n---\nNo links yet');
  await writeMarkdownFile('target.md', '---\ntitle: Target\n---\nContent');
  await store.sync();

  // Test only covers ADDING a link
  await writeMarkdownFile('source.md', '---\ntitle: Source\n---\nLink to [[target]]');
  // ... verifies edge exists

  // Missing: remove the link and verify edge is removed
});
```

**Fix:** Add follow-up modification that removes the link, verify `getNeighbors` no longer returns target.

**Verification:** Test should fail if link removal doesn't update graph.

---

### [MEDIUM] Transient file test has weak timing assumptions

**Location:** `tests/integration/watcher/file-events.test.ts:175-196`

**Problem:** Test creates transient file, waits 50ms, then deletes. The 50ms is arbitrary - if filesystem events are slower, the delete might arrive in a different batch than the add, causing test to fail intermittently or pass when it shouldn't.

**Evidence:**
```typescript
// Create and delete transient file within debounce window
const transientPath = await writeMarkdownFile('transient.md', '# Transient');
await new Promise((r) => setTimeout(r, 50));
await unlink(transientPath);
```

**Fix:** Use FileWatcher's `flush()` or control timing through mocks. The 50ms assumes debounce window is still open, but doesn't verify it.

**Verification:** Change debounce to 10ms and see if test behavior changes.

---

### [MEDIUM] No test for multiple simultaneous deletions

**Location:** `tests/integration/watcher/file-events.test.ts:119-134` (known issue - see `docs/issues/watcher-test-gaps.md`)

**Problem:** Single file deletion is tested. No test for deleting multiple files simultaneously (e.g., folder deletion, `rm -rf`).

**Evidence:**
```typescript
it('detects file deletion and removes from cache', async () => {
  const filePath = await writeMarkdownFile('to-delete.md', '# Will be deleted');
  // ... only deletes one file
});
```

**Fix:** Add test that deletes 3+ files at once, verify all are removed from cache in single batch.

**Verification:** Test should pass with correct implementation of batch deletion handling.

---

### [MEDIUM] Stabilization delay is a magic number

**Location:** `tests/integration/watcher/file-events.test.ts:13`

**Problem:** `WATCHER_STABILIZATION_MS = 100` is undocumented magic number. The comment explains what it does but not why 100ms is sufficient. This could cause flaky tests on slow CI systems.

**Evidence:**
```typescript
/**
 * Delay after startWatching() resolves to let OS-level filesystem watcher stabilize.
 * chokidar's 'ready' event fires after initial directory scan, but FSEvents/inotify
 * may need additional time before reliably delivering events.
 */
const WATCHER_STABILIZATION_MS = 100;
```

**Fix:** Either:
1. Document how 100ms was determined (empirical testing? platform-specific?)
2. Make configurable for CI environments
3. Use event-driven confirmation instead of fixed delay

**Verification:** Run tests on slow filesystem (network mount, overloaded CI) - should still pass.

---

### [MEDIUM] createChangeCapture only captures first callback

**Location:** `tests/integration/watcher/file-events.test.ts:19-42`

**Problem:** The capture helper overwrites `capturedIds` on each callback. Tests using it can only assert on the LAST batch, not intermediate batches or batch count.

**Evidence:**
```typescript
const callback = (changedIds: string[]) => {
  capturedIds = changedIds;  // Overwrites, doesn't accumulate
};
```

This is used in tests like "detects file modification" which implicitly assume single batch.

**Fix:** Capture all batches in array, allow assertions on batch count and individual batch contents.

**Verification:** Add test that expects exactly 2 batches - current helper can't support this.

---

### [MEDIUM] Vector embedding cleanup test doesn't verify intermediate state

**Location:** `tests/integration/watcher/file-events.test.ts:275-303`

**Problem:** Test sets up embedding, deletes file, verifies embedding is gone. Doesn't verify embedding existed at the right point in time.

**Evidence:**
```typescript
await vectorProvider.store('with-embedding.md', [0.1, 0.2, 0.3], 'test-model');
expect(vectorProvider.hasEmbedding('with-embedding.md')).toBe(true);
// ... delete happens
expect(vectorProvider.hasEmbedding('with-embedding.md')).toBe(false);
```

What if `hasEmbedding` always returns false? Test would pass.

**Fix:** Add intermediate assertion that the node exists in cache AND has embedding before deletion.

**Verification:** Mock `hasEmbedding` to always return false - test should fail but might not.

---

### [LOW] Wiki-link resolution uses trivial case

**Location:** `tests/integration/watcher/file-events.test.ts:198-216` (related: `docs/issues/Watcher Wiki-Link Resolution Test Gap.md`)

**Problem:** Test links `[[target]]` to `target.md`. This works without resolution because raw link matches node ID. Doesn't test that resolution logic actually runs.

**Evidence:**
```typescript
await writeMarkdownFile('source.md', '---\ntitle: Source\n---\nLink to [[target]]');
// ...
neighbors = await store.getNeighbors('source.md', { direction: 'out' });
expect(neighbors.map((n) => n.id)).toContain('target.md');
```

**Fix:** Use nested path target (`folder/target.md`) with bare wiki-link (`[[target]]`) to force resolution.

**Verification:** Break resolution logic - test should fail but currently passes.

---

### [LOW] No negative test for write callback error recovery

**Location:** `tests/integration/watcher/file-events.test.ts` (missing)

**Problem:** No test verifies that the watcher continues operating if the onChange callback throws. Unit tests cover `onBatch` error handling in FileWatcher, but integration test doesn't verify DocStore's `handleWatcherBatch` error propagation.

**Fix:** Add test where onChange throws, verify watcher continues processing subsequent events.

**Verification:** Test should demonstrate graceful degradation.

---

### [LOW] No test for case sensitivity edge cases

**Location:** `tests/integration/watcher/file-events.test.ts` (missing)

**Problem:** No test for mixed-case file paths on case-insensitive filesystems. `File.MD` and `file.md` are the same file on macOS/Windows but different on Linux.

**Fix:** Add test that creates `File.MD`, triggers event with `file.md` path, verifies correct behavior.

**Verification:** Test should pass on all platforms or be skipped on case-sensitive filesystems.

## References

- Existing known issues: `docs/issues/watcher-test-gaps.md`
- Wiki-link gap: `docs/issues/Watcher Wiki-Link Resolution Test Gap.md`
- Coalescing assertions: `docs/issues/watcher-event-coalescing-cache-state-assertions.md`
