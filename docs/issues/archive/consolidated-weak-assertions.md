---
id: KMUTZVTl1XaH
title: consolidated-weak-assertions
tags:
  - consolidated
  - test-audit
  - assertions
  - testing
status: open
priority: medium
---
# Consolidated: Weak Assertions Pattern

## Problem Pattern
Tests verify structural properties (length, existence, type) but not semantic correctness. A buggy implementation that returns wrong values in the right shape would pass these tests.

## Affected Locations

| File | Finding | Severity |
|------|---------|----------|
| tests/unit/docstore/cache/embeddings.test.ts | Round-trip test only checks `toHaveLength(3)`, not values | LOW |
| tests/unit/mcp/truncate.test.ts | Content preservation not verified (only length + suffix) | HIGH |
| tests/unit/mcp/transforms.test.ts | Truncation boundary assertion obscures actual behavior | MEDIUM |
| tests/unit/graph/traversal.test.ts | Path validity not verified (edges exist between consecutive nodes) | MEDIUM |
| tests/unit/graph/index.test.ts | Export tests only check `toBeDefined()` and `typeof` | MEDIUM |
| tests/unit/docstore/reader-registry.test.ts | `parse()` only checks `node.title`, not full structure | MEDIUM |
| tests/unit/mcp/handlers-integration.test.ts | `'incomingNeighbors' in result` but content not verified | HIGH |
| tests/unit/docstore/watcher.test.ts | "upserts node" only checks title, not content | HIGH |
| tests/unit/core/graphcore.test.ts | Search score conversion claimed but never asserted | MEDIUM |
| tests/unit/integration/graphcore.test.ts | Semantic ranking is probabilistic, could pass by accident | HIGH |
| tests/unit/cli/status.test.ts | Edge count mechanism not verified (could silently be 0) | HIGH |

## Root Cause Analysis
Weak assertions arise from:
1. **Lazy test writing**: `expect(x).toBeDefined()` is the easiest assertion
2. **Implementation coupling**: Tests check implementation artifacts, not contracts
3. **Implicit trust**: Tests assume if part is right, the whole is right

This allows regressions where:
- Values are corrupted but structure preserved
- Ordering changes but sets are equal
- Side effects occur but primary return value is correct

## Fix Strategy

1. **Replace existence checks with value assertions**:
   ```typescript
   // Before (weak)
   expect(response.content.length).toBe(TRUNCATION_LIMITS.primary);
   
   // After (strong)
   const expectedPrefix = original.slice(0, TRUNCATION_LIMITS.primary - suffix.length);
   expect(response.content.startsWith(expectedPrefix)).toBe(true);
   expect(response.content.endsWith(suffix)).toBe(true);
   ```

2. **Verify semantic relationships, not just structure**:
   ```typescript
   // Before (weak)
   expect(result!.incomingNeighbors).toBeDefined();
   
   // After (strong)
   expect(result!.incomingNeighbors).toHaveLength(1);
   expect(result!.incomingNeighbors[0].id).toBe('parent.md');
   expect(result!.incomingNeighbors[0].title).toBe('Parent');
   ```

3. **Add round-trip value verification**:
   ```typescript
   // Before (weak)
   expect(result.vector).toHaveLength(3);
   
   // After (strong)
   expect(result.vector[0]).toBeCloseTo(0.1, 5);
   expect(result.vector[1]).toBeCloseTo(0.2, 5);
   expect(result.vector[2]).toBeCloseTo(0.3, 5);
   ```

4. **Verify graph path validity**:
   ```typescript
   // Before (weak)
   expect(path).toHaveLength(3);
   
   // After (strong)
   expect(path).toHaveLength(3);
   for (let i = 0; i < path.length - 1; i++) {
     expect(graph.hasDirectedEdge(path[i], path[i + 1])).toBe(true);
   }
   ```

5. **Strengthen export tests**:
   ```typescript
   // Before (weak)
   expect(buildGraph).toBeDefined();
   expect(typeof buildGraph).toBe('function');
   
   // After (strong)
   const graph = buildGraph([]);
   expect(graph.order).toBe(0);
   ```

6. **Document probabilistic test bounds**:
   ```typescript
   // If test is inherently probabilistic, make it explicit
   it('returns different nodes over 50 calls (probabilistic)', () => {
     const seen = new Set<string>();
     for (let i = 0; i < 50; i++) {
       const node = getRandomNode();
       if (node) seen.add(node.id);
     }
     // With 3 nodes and 50 calls, expect at least 2 different results
     expect(seen.size).toBeGreaterThan(1);
   });
   ```

## Verification
1. For each weak assertion, intentionally break the implementation in a way that preserves structure
2. Confirm the weak test passes (demonstrating the gap)
3. Add strong assertion and confirm it fails
4. Restore implementation and verify test passes

## Source Audits
- [[audit-cache-embeddings-test]]
- [[audit-mcp-truncate-test]]
- [[audit-mcp-transforms-test]]
- [[audit-graph-traversal-test]]
- [[audit-graph-index-test]]
- [[audit-reader-registry-test]]
- [[audit-mcp-handlers-integration-test]]
- [[audit-docstore-watcher-test]]
- [[audit-core-graphcore-test]]
- [[audit-graphcore-integration-test]]
- [[audit-cli-status-test]]
