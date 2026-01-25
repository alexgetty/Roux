---
type: Issue
severity: Medium
component: Multiple
phase: Resolution
---

# Red Team Round 8 Tech Debt

## Cache: Fuzzy threshold boundary test

**File:** `tests/unit/docstore/cache.test.ts`

Tests verify typos match above threshold but don't assert behavior exactly at threshold (0.7). A query with score 0.69 vs 0.71 is implied but not explicit.

## Cache: Semantic strategy fallthrough

**File:** `tests/unit/docstore/cache.test.ts`
**Implementation:** `src/providers/docstore/cache.ts:329-331`

Cache returns `{ match: null, score: 0 }` for semantic strategy (correctly delegating to GraphCore), but this path has no unit test.

## Handlers: Error propagation for resolveNodes

**File:** `tests/unit/mcp/handlers.test.ts`

No test verifies what happens when `core.resolveNodes` throws unexpectedly (e.g., embedding provider failure during semantic resolution).

## Handlers: Combined filter behavior

**File:** `tests/unit/mcp/handlers.test.ts`

`handleListNodes` tests tag and path filters separately. Combined behavior tested for parameter passing but not actual filtering (integration scope).

## Server: Magic numbers for tool count

**File:** `tests/unit/mcp/server.test.ts:140-151`

Asserts `12` and `13` tools as literals. Fragile — adding a tool requires updating two places.

## References

- Red-team audit (2026-01-24)
