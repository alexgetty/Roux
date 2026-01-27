---
title: FileWatcher Default Debounce Not Directly Tested
tags:
  - issue
  - watcher
  - testing
---
# FileWatcher Default Debounce Not Directly Tested

**Type:** Test Gap
**Priority:** Medium
**Component:** FileWatcher

## Problem

Test at `file-watcher.test.ts:496-512` claims to test default 1000ms debounce but doesn't actually verify the value:

```typescript
it('uses default 1000ms debounce when not specified', () => {
  const watcher = new FileWatcher({
    root: sourceDir,
    onBatch: vi.fn(),
  });
  watcher.start();
  triggerReady();
  
  // Implementation should use 1000ms default
  // We test this indirectly through real timer test above
  expect(watcher).toBeDefined(); // THIS TESTS NOTHING
  
  watcher.stop();
});
```

This test passes even if default debounce is 0ms or 10 seconds.

## Fix

Either:
1. Make debounceMs accessible via getter and test directly
2. Use real timers to verify 1000ms behavior:

```typescript
it('uses default 1000ms debounce when not specified', async () => {
  vi.useRealTimers();
  const onBatch = vi.fn();
  const watcher = new FileWatcher({ root: sourceDir, onBatch });
  const promise = watcher.start();
  triggerReady();
  await promise;
  
  triggerEvent('add', join(sourceDir, 'test.md'));
  
  // After 900ms, should not have fired
  await new Promise(r => setTimeout(r, 900));
  expect(onBatch).not.toHaveBeenCalled();
  
  // After 200ms more (1100ms total), should have fired
  await new Promise(r => setTimeout(r, 200));
  expect(onBatch).toHaveBeenCalled();
  
  watcher.stop();
});
```
