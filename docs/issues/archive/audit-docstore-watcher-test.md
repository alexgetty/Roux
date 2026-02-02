---
id: WqriCc0pKWfF
title: audit-docstore-watcher-test
tags:
  - test-audit
  - docstore
status: open
---
# Test Audit: watcher.test.ts

> **Consolidated into:** [[consolidated-weak-assertions]], [[consolidated-error-propagation-gaps]]

## Summary

The watcher integration tests provide reasonable coverage of the happy path but have weak assertions, missing edge cases for error handling, and incomplete verification of cache state after operations.

## Findings

### [HIGH] Missing Cache State Verification After Node Updates

**Problem:** The "upserts node on change event" test only verifies the title changed but doesn't verify content was updated.

---

### [HIGH] unlink on Non-Existent Node Not Tested

**Problem:** The implementation has a guard `if (existing)` but this branch isn't tested when `existing` is falsy.

---

### [MEDIUM] onChange Callback Receives Incomplete ID List on Partial Failure

**Problem:** Test only checks that `onChange` was called, not which IDs were passed.

---

### [MEDIUM] vectorProvider.delete() Failure Not Tested

**Problem:** The mock always succeeds. No test verifies behavior when delete throws.

---

### [MEDIUM] Graph Rebuild Not Asserted for unlink Events

**Problem:** "rebuilds graph after processing queue" only tests add. No equivalent test for unlink.

---

### [MEDIUM] parseFile Failure Doesn't Remove Stale Cache Entry

**Problem:** When parse fails on change event, old node remains in cache. Not explicitly tested.

## References

- Watcher Wiki-Link Resolution Test Gap.md
- watcher-event-coalescing-cache-state-assertions.md
