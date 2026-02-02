---
id: omlKbHjvD878
title: Watcher Test Gaps
tags:
  - issue
  - watcher
  - testing
type: '[[Test Gap]]'
priority: Medium
component: '[[Watcher]]'
status: open
---
# Watcher Test Gaps

Missing test coverage for watcher edge cases.

## Status After FileWatcher Extraction

Reviewed 2026-01-26. Updated after red team review.

## 1. Restart Watching - RESOLVED

**Status:** Fixed in FileWatcher extraction.

`file-watcher.test.ts:705-770` contains two restart tests:
- `can restart after stop()` - verifies restart works
- `clears state between restarts` - verifies no leakage

## 2. Link Removal Not Tested - UNCHANGED

**Location:** `tests/integration/watcher/file-events.test.ts:153-174`

Tests that adding a link updates graph, but doesn't test that removing a link also updates graph.

**Fix:** Add test: create file with link, sync, modify to remove link, verify graph updated.

## 3. Delete + Immediate Recreate Race - RESOLVED

**Status:** Fixed by FileWatcher extraction.

`file-watcher.test.ts:394-408` tests `unlink + add = add` coalescing rule.

## 4. Multiple Files Deleted Simultaneously - UNCHANGED

**Location:** `tests/integration/watcher/file-events.test.ts:82-102`

Tests single file deletion. No test for deleting 3+ files at once (folder deletion).

## 5. Windows Path Normalization - STILL OPEN

**Location:** `watcher.ts:119, 135`

`relative()` produces backslashes on Windows. Implementation handles it, tests don't verify.

See: `docs/issues/filewatcher-windows-path-not-tested.md`

## 6. Duplicate Event Coalescing - NEW

**Location:** `tests/unit/docstore/file-watcher.test.ts`

No test for `add + add` or `unlink + unlink` on same file. Probably idempotent but should verify.

## References

- Red team round 5 #9, #11
- Red team round 6 #7, #8, #9
- FileWatcher extraction red team 2026-01-26
