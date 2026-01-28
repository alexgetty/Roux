---
tags:
  - consolidated
  - test-audit
  - boundaries
  - edge-cases
status: open
priority: high
title: consolidated-boundary-conditions
---

# Consolidated: Boundary Condition Test Gaps

## Problem Pattern
Tests cover typical values but miss boundary conditions: empty collections, zero values, exact thresholds, minimum/maximum limits. Functions behave correctly at boundaries but this behavior is undocumented and fragile.

## Affected Locations

| File | Finding | Severity |
|------|---------|----------|
| tests/unit/docstore/cache/resolve.test.ts | Threshold boundary (score === threshold) not tested | MEDIUM |
| tests/unit/docstore/cache/centrality.test.ts | Zero pagerank, zero degree counts untested | MEDIUM |
| tests/unit/docstore/cache/embeddings.test.ts | Empty vector array untested | MEDIUM |
| tests/unit/utils/math.test.ts | Empty vector `[]` behavior untested | HIGH |
| tests/unit/utils/math.test.ts | Dimension mismatch silently produces garbage | HIGH |
| tests/unit/utils/heap.test.ts | Duplicate values not tested | MEDIUM |
| tests/unit/graph/manager.test.ts | Empty nodes array not tested | HIGH |
| tests/unit/graph/manager.test.ts | `limit=0` behavior untested | MEDIUM |
| tests/unit/mcp/transforms.test.ts | Exactly at truncation limit not tested | LOW |
| tests/unit/mcp/transforms.test.ts | `MAX_LINKS_TO_RESOLVE` boundary (99, 100, 101) | MEDIUM |
| tests/unit/mcp/handlers.test.ts | Score calculation for 21+ results (negative before clamp) | MEDIUM |
| tests/unit/docstore/docstore.test.ts | `resolveNodes` threshold boundaries (0, 1, exact) | MEDIUM |
| tests/unit/cli/viz.test.ts | Empty graph (zero nodes) not tested | HIGH |

## Root Cause Analysis
Boundary conditions are easy to overlook because:
1. **Happy path bias**: Tests focus on "typical" usage, not edge cases
2. **Implementation details leak**: Tests assume internal behavior without verifying it
3. **Off-by-one ambiguity**: `>=` vs `>`, `<` vs `<=` choices aren't documented

These gaps allow regressions where a `>=` is changed to `>` and tests still pass.

## Fix Strategy

1. **Add boundary test pattern** for each numeric parameter:
   ```typescript
   describe('threshold boundary', () => {
     it('accepts match when score equals threshold (>=)', () => {
       // Need to craft input that produces exactly threshold score
     });
     
     it('accepts threshold of 0 (matches everything)', () => { ... });
     it('accepts threshold of 1 (exact only)', () => { ... });
   });
   ```

2. **Empty collection tests**:
   ```typescript
   it('handles empty input array', () => {
     expect(cosineSimilarity([], [])).toBe(0); // or throws - document it
   });
   
   it('returns empty map for empty nodes', () => {
     const centrality = manager.build([]);
     expect(centrality.size).toBe(0);
   });
   ```

3. **Dimension mismatch should throw or document**:
   ```typescript
   it('throws when vectors have different dimensions', () => {
     expect(() => cosineSimilarity([1,2,3], [1,2])).toThrow(/dimension/i);
   });
   // OR document current behavior:
   it('returns NaN when vectors have different dimensions (KNOWN BUG)', () => {
     expect(cosineSimilarity([1,2,3], [1,2])).toBeNaN();
   });
   ```

4. **Exact-at-limit tests**:
   ```typescript
   it('includes all links when exactly at MAX_LINKS_TO_RESOLVE', () => {
     const exactLinks = Array.from({ length: 100 }, (_, i) => `link-${i}.md`);
     // verify all 100 are included
   });
   
   it('truncates when one over MAX_LINKS_TO_RESOLVE', () => {
     const overByOne = Array.from({ length: 101 }, (_, i) => `link-${i}.md`);
     // verify only 100 are included
   });
   ```

## Verification
1. For each boundary test, verify behavior with current implementation
2. Temporarily change implementation (e.g., `>=` to `>`) and confirm test catches it
3. Document the expected behavior in test names

## Source Audits
- [[audit-cache-resolve-test]]
- [[audit-cache-centrality-test]]
- [[audit-cache-embeddings-test]]
- [[audit-utils-math-test]]
- [[audit-utils-heap-test]]
- [[audit-graph-manager-test]]
- [[audit-mcp-transforms-test]]
- [[audit-mcp-handlers-test]]
- [[audit-docstore-test]]
- [[audit-cli-viz-test]]
