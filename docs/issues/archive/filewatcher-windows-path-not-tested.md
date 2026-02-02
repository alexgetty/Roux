---
id: oxC7tDfjHXSN
title: FileWatcher Windows Path Not Tested
tags:
  - issue
  - watcher
  - testing
  - windows
---
# FileWatcher Windows Path Not Tested

**Type:** Test Gap
**Priority:** Medium
**Component:** FileWatcher

## Problem

`relative()` produces backslashes on Windows. The implementation at `watcher.ts:119` uses:
```typescript
const relativePath = relative(this.root, filePath);
```

Then at line 135:
```typescript
const id = relativePath.toLowerCase().replace(/\\/g, '/');
```

The backslash replacement is there, but no test verifies it works.

## Evidence

`file-watcher.test.ts:308-323` tests nested paths with forward slashes only:
```typescript
triggerEvent('add', join(sourceDir, 'folder/subfolder/deep.md'));
expect(onBatch).toHaveBeenCalledWith(
  new Map([['folder/subfolder/deep.md', 'add']])
);
```

## Fix

Add test with explicit backslash path:
```typescript
it('normalizes Windows backslash paths', () => {
  const onBatch = vi.fn();
  const watcher = new FileWatcher({ root: sourceDir, onBatch });
  watcher.start();
  triggerReady();
  
  // Simulate Windows path
  triggerEvent('add', sourceDir + '\\folder\\test.md');
  watcher.flush();
  
  expect(onBatch).toHaveBeenCalledWith(
    new Map([['folder/test.md', 'add']])
  );
});
```

## References

- docs/issues/watcher-test-gaps.md #5
