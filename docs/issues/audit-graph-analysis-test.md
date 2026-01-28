---
title: audit-graph-analysis-test
tags:
  - test-audit
  - graph
status: open
---
# Test Audit: graph/analysis.test.ts

> **Consolidated into:** [[consolidated-graph-topology-coverage]], [[consolidated-boundary-conditions]]

## Summary

The `analysis.test.ts` file tests `computeCentrality` with only 2 test cases. Coverage appears complete at line level but misses several graph topology edge cases and lacks assertion depth.

## Findings

### [MEDIUM] Single Graph Topology Tested

**Problem:** All positive tests use the same 5-node DAG from `createTestGraph()`. No cycles, self-loops, disconnected components, or isolated nodes tested.

---

### [MEDIUM] No Test for Single Node Graph

**Problem:** Tests cover empty graph and 5-node graph, but skip the minimal non-empty case: a single node with no edges.

---

### [MEDIUM] Self-Loop Not Tested

**Problem:** A node with a self-loop is a valid graph configuration but not tested.

---

### [LOW] Map Key Existence Not Verified

**Problem:** Tests use `centrality.get('a')` without first asserting that the key exists.

## References

- [[Graph Test Coverage]]
