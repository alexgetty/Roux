---
title: audit-graph-builder-test
tags:
  - test-audit
  - graph
status: open
---
# Test Audit: graph/builder.test.ts

> **Consolidated into:** [[consolidated-graph-topology-coverage]], [[consolidated-empty-string-validation]]

## Summary

The test suite covers core happy paths but has significant gaps around edge cases, error conditions, and boundary validation.

## Findings

### [HIGH] No test for duplicate node IDs

**Problem:** `buildGraph` calls `graph.addNode(node.id)` without checking if the node already exists. This is noted in [[Graph Test Coverage]] but remains unimplemented.

---

### [MEDIUM] No test for empty string node ID

**Problem:** The function accepts nodes with empty string IDs. Graphology allows empty string as a node key.

---

### [MEDIUM] No test for whitespace-only node ID

**Problem:** Similar to empty string, nodes with whitespace-only IDs are accepted.

---

### [MEDIUM] No test for case sensitivity of node IDs

**Problem:** The codebase normalizes IDs to lowercase elsewhere, but `buildGraph` treats `A.md` and `a.md` as different nodes.

## References

- [[Graph Test Coverage]]
- [[roux-id-normalization-bug]]
