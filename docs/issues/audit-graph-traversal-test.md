---
title: audit-graph-traversal-test
tags:
  - test-audit
  - graph
status: open
---
# Test Audit: graph/traversal.test.ts

> **Consolidated into:** [[consolidated-graph-topology-coverage]], [[consolidated-weak-assertions]]

## Summary

The traversal tests cover basic happy paths well but miss critical edge cases around graph topology (self-loops, isolated nodes, disconnected components), determinism of results, and incomplete verification of algorithm correctness.

## Findings

### [HIGH] Self-loop behavior untested

**Problem:** No tests verify behavior when a node links to itself. Self-loops affect neighbor counts, path finding, and hub calculations.

---

### [HIGH] getHubs tie-breaking behavior unverified

**Problem:** When multiple nodes have the same degree, the test doesn't verify consistent/deterministic ordering.

---

### [MEDIUM] findPath doesn't verify actual shortest path

**Problem:** Test only checks length and endpoints, not that the path is valid (edges exist between consecutive nodes).

---

### [MEDIUM] Isolated node behavior untested

**Problem:** No test for a node with zero edges.

---

### [MEDIUM] Disconnected graph components untested

**Problem:** Tests unreachable due to edge direction, not disconnected components.

---

### [MEDIUM] getNeighborIds "both" deduplication untested

**Problem:** When a node has both incoming and outgoing edges to the same neighbor, does "both" return duplicates?

## Cross-reference

See [[Graph Test Coverage]] for related known issues.
