---
id: 3tXXNGsi2DUu
title: audit-mcp-transforms-test
tags:
  - test-audit
  - mcp
  - issue
---
# Test Audit: mcp/transforms.test.ts

> **Consolidated into:** [[consolidated-error-propagation-gaps]], [[consolidated-weak-assertions]], [[consolidated-boundary-conditions]]

## Summary

The transforms test file has solid coverage of happy paths but lacks error handling tests, boundary condition tests, and has some assertions that pass by accident.

## Findings

### [HIGH] nodeToResponse Missing Error Handling Test

**Problem:** No test verifies behavior when `store.resolveTitles` throws. The implementation does not wrap this call in try/catch.

---

### [HIGH] nodeToContextResponse Missing Error Handling Tests

**Problem:** No tests verify behavior when parallel Promise.all branches fail.

---

### [MEDIUM] Truncation Length Assertion Obscures Implementation

**Problem:** Test asserts length equals limit but doesn't verify the suffix is included or content was truncated correctly.

---

### [MEDIUM] Missing Boundary Tests for MAX_LINKS_TO_RESOLVE

**Problem:** Only tests 150 links (well over limit). Missing tests for exactly 100, 101, and 99 links.

---

### [MEDIUM] hubsToResponses Missing Empty Array Test

**Problem:** No test for empty hubs array input.

## Cross-References

- [[MCP Layer Gaps]]
- [[mcp-handler-test-gaps-round-1]]
