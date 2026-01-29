---
title: audit-watcher-file-events-test
tags:
  - test-audit
  - integration
  - watcher
status: open
---
# Test Audit: file-events.test.ts

> **Consolidated into:** [[consolidated-timing-based-flakiness]], [[consolidated-mock-quality]]

## Summary

Integration tests for the file watcher cover basic CRUD scenarios but have gaps in edge case coverage, weak assertions on intermediate state, and rely heavily on timing.

## Findings

### [HIGH] Timing-based test assertions can pass by accident

**Problem:** The batching test uses fixed delays and accepts 1-3 batches. A regression that always fires 3 batches would not be caught.

**Fix:** Use `flush()` or control timing through mocks.

---

### [HIGH] No test for link removal updating the graph

**Problem:** Test verifies adding a link updates graph edges. No test verifies REMOVING a link also updates the graph.

---

### [MEDIUM] Transient file test has weak timing assumptions

**Problem:** The 50ms delay assumes debounce window is still open, but doesn't verify it.

---

### [MEDIUM] No test for multiple simultaneous deletions

**Problem:** Single file deletion tested. No test for deleting multiple files simultaneously.

---

### [MEDIUM] Stabilization delay is a magic number

**Problem:** `WATCHER_STABILIZATION_MS = 100` is undocumented magic number.

---

### [MEDIUM] createChangeCapture only captures first callback

**Problem:** The capture helper overwrites on each callback, can only assert on last batch.

## References

- watcher-test-gaps.md
- Watcher Wiki-Link Resolution Test Gap.md
