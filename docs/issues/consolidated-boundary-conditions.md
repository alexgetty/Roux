---
title: consolidated-boundary-conditions
tags:
  - consolidated
  - test-audit
  - boundaries
  - edge-cases
  - archived
status: open
priority: high
---
# Consolidated: Boundary Condition Test Gaps

**Status: RESOLVED** — Fixed in commit (pending)

## Problem Pattern
Tests cover typical values but miss boundary conditions: empty collections, zero values, exact thresholds, minimum/maximum limits.

## Resolution

All 13 findings addressed with +36 tests:

- **math.ts**: Empty vectors and dimension mismatch now throw (was silent garbage)
- **heap.ts**: Duplicate values tested
- **graph/manager.ts**: Empty graph and limit=0 tested  
- **cli/viz.ts**: Zero nodes tested
- **cache/resolve.ts**: Threshold boundaries (0, 1, exact) tested, `>=` semantics documented
- **cache/centrality.ts**: Zero degree handling tested
- **docstore.ts**: resolveNodes threshold boundaries tested
- **mcp/transforms.ts**: MAX_LINKS_TO_RESOLVE (99/100/101) and truncation boundaries tested
- **mcp/handlers.ts**: Score clamping at index 20+ tested

Note: `cache/embeddings.test.ts` item was stale — coverage already existed in `vector/sqlite.test.ts`.
