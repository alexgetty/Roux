---
title: audit-file-watcher-test
tags:
  - test-audit
  - docstore
---
# Test Audit: file-watcher.test.ts

> **Consolidated into:** [[consolidated-mock-quality]], [[consolidated-timing-based-flakiness]]

---
tags: [test-audit, docstore]
status: open
---

## Summary

The test file has good coverage of happy paths but relies heavily on mocking that obscures real behavior. Several tests verify implementation details rather than contracts.

## Findings

### [HIGH] Test File Imports From Wrong Path

**Problem:** Import references `file-watcher.ts` but implementation is `watcher.ts`. Minor naming inconsistency.

---

### [HIGH] Mocking Undermines Coalescing Tests

**Problem:** The mock watcher bypasses chokidar's actual behavior and only tests that handlers were registered.

---

### [HIGH] Default Debounce Test Asserts Nothing

**Problem:** Test claims to verify 1000ms default debounce but actually just checks `watcher` is defined.

---

### [MEDIUM] Windows Path Normalization Not Tested

**Problem:** Implementation has backslash replacement but no test verifies this.

---

### [MEDIUM] triggerReady() Not Awaited Before triggerEvent()

**Problem:** Several tests trigger events before ready fires, testing unrealistic scenarios.

---

### [LOW] flush() Timing Race in Real Timer Test

**Problem:** Test uses real timers with exact timing that could drift causing flakiness.

## Already Known Issues

- filewatcher-windows-path-not-tested.md
- filewatcher-default-debounce-not-directly-tested.md
- excludeddirs-immutability-test-is-weak.md
