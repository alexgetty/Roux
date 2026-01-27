---
title: DocStore FileWatcher Injection Not Tested
tags:
  - issue
  - docstore
  - testing
---
# DocStore FileWatcher Injection Not Tested

**Type:** Test Gap
**Priority:** Medium
**Component:** DocStore

## Problem

The summary claims DocStore constructor now accepts FileWatcher injection for testing:
> Added: Constructor parameter for FileWatcher injection (testing)

But `docstore/index.ts:50-51` shows:
```typescript
fileWatcher?: FileWatcher
// ...
this.fileWatcher = fileWatcher ?? null;
```

No test verifies this works. The injection is unused in tests—all tests rely on the default FileWatcher creation.

## Fix

Add test to `watcher.test.ts`:
```typescript
it('accepts injected FileWatcher', async () => {
  const mockFileWatcher = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    isWatching: vi.fn().mockReturnValue(true),
  } as unknown as FileWatcher;
  
  const store = new DocStore(sourceDir, cacheDir, undefined, mockFileWatcher);
  await store.startWatching();
  
  expect(mockFileWatcher.start).toHaveBeenCalled();
  store.close();
});
```

This validates the DI pattern claimed in the summary.
