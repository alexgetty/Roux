---
id: oz3xb1JAtfyS
title: audit-cache-centrality-test
tags:
  - test-audit
  - docstore
  - cache
status: open
---
# Test Audit: cache/centrality.test.ts

> **Consolidated into:** [[consolidated-boundary-conditions]], [[consolidated-empty-string-validation]]

## Summary

The centrality cache tests cover basic happy paths but miss critical edge cases including foreign key violations, boundary values, and SQL injection.

## Findings

### [HIGH] Foreign Key Violation Behavior Untested

**Problem:** No test verifies what happens when storing centrality for a non-existent node ID.

---

### [HIGH] Upsert Test Has Incomplete Assertions

**Problem:** The overwrite test only verifies `pagerank` and `computed_at` were updated, not `in_degree` and `out_degree`.

---

### [MEDIUM] Boundary Values Untested

**Problem:** No tests for zero pagerank, zero degree counts, or large integers.

---

### [MEDIUM] SQL Injection Not Explicitly Tested

**Problem:** While parameterized queries are used, there's no defensive test documenting safety.

---

### [LOW] Type Assertions Bypass Runtime Validation

**Problem:** Tests use TypeScript `as` casts to assume returned row shapes.

## References

- [[Cache]]
- [[TDD]]
- [[cache-test-gaps]]
