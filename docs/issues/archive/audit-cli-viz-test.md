---
id: PuE5g1HXtkc-
title: audit-cli-viz-test
tags:
  - test-audit
  - cli
status: open
---
# Test Audit: cli/viz.test.ts

> **Consolidated into:** [[consolidated-boundary-conditions]], [[consolidated-empty-string-validation]], [[consolidated-unicode-i18n-handling]]

## Summary

The viz command tests cover the happy path adequately but miss several edge cases, error paths, and have weak assertions.

## Findings

### [HIGH] Empty Graph Not Tested

**Problem:** No test verifies behavior when the store has zero nodes.

---

### [HIGH] Cache Failure Not Tested

**Problem:** If `cache.getAllNodes()` throws, the error propagates uncaught.

---

### [MEDIUM] HTML Content Not Actually Validated

**Problem:** Tests use weak assertions that could pass with malformed HTML.

---

### [MEDIUM] Node Title XSS/Injection Not Tested

**Problem:** No test verifies titles containing special characters are handled safely.

---

### [MEDIUM] Output Path Edge Cases Not Tested

**Problem:** Paths with spaces, existing files, relative paths untested.

---

### [MEDIUM] Self-Referencing Links Not Tested

**Problem:** No test for a node that links to itself.

---

### [LOW] Large Graph Performance Not Tested

**Problem:** All tests use 0-2 nodes.
