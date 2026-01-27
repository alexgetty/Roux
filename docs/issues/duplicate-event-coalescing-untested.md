---
title: Duplicate Event Coalescing Untested
tags:
  - issue
  - watcher
  - testing
---
# Duplicate Event Coalescing Untested

**Type:** Test Gap
**Priority:** Medium
**Component:** FileWatcher

## Problem

No test verifies behavior when the same event type fires twice for the same file:
- `add + add` for same file
- `unlink + unlink` for same file

The code handles this (falls through to overwrite with same value) but it's undocumented and untested.

## Evidence

`file-watcher.test.ts` coalescing tests cover:
- add + change
- add + unlink
- change + change ✓ (this one is tested)
- change + unlink
- change + add
- unlink + add
- unlink + change

Missing:
- add + add
- unlink + unlink

## Fix

Add to `file-watcher.test.ts` event coalescing section:

```typescript
it('add + add = add (duplicate ignored)', () => {
  const onBatch = vi.fn();
  const watcher = new FileWatcher({ root: sourceDir, onBatch });
  watcher.start();
  triggerReady();

  triggerEvent('add', join(sourceDir, 'dup.md'));
  triggerEvent('add', join(sourceDir, 'dup.md'));

  watcher.flush();
  expect(onBatch).toHaveBeenCalledWith(new Map([['dup.md', 'add']]));
  expect(onBatch).toHaveBeenCalledTimes(1);
});

it('unlink + unlink = unlink (duplicate ignored)', () => {
  const onBatch = vi.fn();
  const watcher = new FileWatcher({ root: sourceDir, onBatch });
  watcher.start();
  triggerReady();

  triggerEvent('unlink', join(sourceDir, 'dup.md'));
  triggerEvent('unlink', join(sourceDir, 'dup.md'));

  watcher.flush();
  expect(onBatch).toHaveBeenCalledWith(new Map([['dup.md', 'unlink']]));
  expect(onBatch).toHaveBeenCalledTimes(1);
});
```

## References

- docs/issues/watcher-test-gaps.md #6
