---
id: IRFdaggk88yY
title: filewatcher-issues
tags:
  - issue
  - watcher
  - testing
  - bug
---
# FileWatcher Issues

Consolidated from: filewatcher-addunlink-skips-debounce-timer-reset, filewatcher-default-debounce-not-directly-tested, filewatcher-windows-path-not-tested, docstore-filewatcher-injection-not-tested, watcher-event-coalescing-cache-state-assertions

## 1. add+unlink Skips Debounce Timer Reset (BUG)

**Location:** `watcher.ts:144-146, 163-169`

When `add + unlink` coalesces to "no event", the debounce timer is still reset. If this is the only event, the timer fires and calls `flush()` with an empty queue. Harmless but wasteful.

**Fix:** Return early after deleting from queue, clear timer if queue is now empty.

## 2. Default Debounce Not Tested (TEST GAP)

**Location:** `file-watcher.test.ts:496-512`

Test claims to verify default 1000ms debounce but only asserts `expect(watcher).toBeDefined()`. Passes regardless of actual debounce value.

**Fix:** Expose `debounceMs` getter, or use real timers to verify 1000ms behavior.

## 3. Windows Path Not Tested (TEST GAP)

**Location:** `watcher.ts:119, 135` / `file-watcher.test.ts:308-323`

Implementation replaces backslashes (`replace(/\\/g, '/')`), but tests only use forward-slash paths.

**Fix:** Add test with explicit backslash path simulation.

## 4. FileWatcher Injection Not Tested (TEST GAP)

**Location:** `docstore/index.ts:50-51`

DocStore constructor accepts optional `fileWatcher` parameter, but no test verifies injected FileWatcher is used. All tests rely on default creation.

**Fix:** Add test passing a mock FileWatcher and verifying `start()` is called on it.

## 5. Event Coalescing Cache State Assertions (TEST GAP)

**Location:** `tests/unit/docstore/watcher.test.ts:361-428`

Coalescing tests verify `onChange` callback arguments but don't assert final cache state. Only `change + unlink = unlink` checks cache.

| Pattern | Callback Tested | Cache Tested |
|---------|----------------|--------------|
| add + change = add | yes | no |
| change + change = change | yes | no |
| change + unlink = unlink | yes | yes |
| add + unlink = nothing | yes | no |

**Fix:** Add `store.getNode()` assertions to all coalescing tests.
