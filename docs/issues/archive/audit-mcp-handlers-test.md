---
id: 5cO0KOKrtrYC
title: audit-mcp-handlers-test
tags:
  - test-audit
  - mcp
status: open
---
# Test Audit: mcp/handlers.test.ts

> **Consolidated into:** [[consolidated-type-guard-validation-gaps]], [[consolidated-error-propagation-gaps]], [[consolidated-boundary-conditions]]

## Summary

Handler test coverage is thorough for happy paths and basic validation, but misses several edge cases around async error handling, type coercion boundaries, and integration with the transform layer.

## Findings

### [HIGH] handleResolveNodes does not validate `names` array elements

**Problem:** The handler checks if `names` is an array but never validates that elements are strings.

---

### [HIGH] handleNodesExist does not validate `ids` array elements

**Problem:** Same issue - checks array but not element types.

---

### [MEDIUM] handleGetNode depth > 1 silently clamped to 1

**Problem:** Depth coercion clamps any value >= 1 to exactly 1, but tests only cover depth 0 and 1.

---

### [MEDIUM] handleSearch score calculation untested for empty results

**Problem:** Edge case of zero results and 21+ results (negative scores before clamp) untested.

---

### [MEDIUM] Transform layer errors not propagated through handlers

**Problem:** No tests verify that transform-layer errors propagate correctly.

---

### [MEDIUM] handleCreateNode/handleUpdateNode empty string handling

**Problem:** Empty string content and title behavior undocumented.
