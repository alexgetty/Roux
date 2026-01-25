---
title: Watcher Test Gaps
tags:
  - issue
  - watcher
  - testing
---
# Watcher Test Gaps

Missing test coverage for watcher edge cases.

## 1. Restart Watching Not Tested

**Location:** `tests/unit/docstore/watcher.test.ts`

No test for `startWatching()` after `stopWatching()`. Should verify watcher can be restarted.

## 2. Link Removal Not Tested

**Location:** `tests/integration/watcher/file-events.test.ts:153-174`

Tests that adding a link updates graph, but doesn't test that removing a link also updates graph.

**Fix:** Add test: create file with link, sync, modify to remove link, verify graph updated.

## 3. Delete + Immediate Recreate Race

**Location:** `tests/integration/watcher/file-events.test.ts:133-155`

Doesn't test "delete then immediately recreate same filename"—edge case where user undoes delete in Obsidian.

## 4. Multiple Files Deleted Simultaneously

**Location:** `tests/integration/watcher/file-events.test.ts:82-102`

Tests single file deletion. No test for deleting 3+ files at once (folder deletion).

## 5. Windows Path Normalization

**Location:** `watcher.test.ts:267-283`, `docstore/index.ts:304`

`relative()` produces backslashes on Windows. `normalizeId()` handles this, but watcher tests only run on Unix paths.

**Fix:** Add comment noting Windows untested, or mock test with backslash paths.

## References

- Red team round 5 #9, #11
- Red team round 6 #7, #8, #9
