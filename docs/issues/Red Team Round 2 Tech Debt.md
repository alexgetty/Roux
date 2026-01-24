---
type: Issue
severity: Medium
component: MCP, Vector
phase: 10
---

# Issue - Red Team Round 2 Tech Debt

Medium-priority issues from Phase 10 red-team audit round 2.

## MCP Handlers

### 1. Negative limit handling undefined

**Location:** `src/mcp/handlers.ts:28-34`

`coerceLimit()` passes negative values through. `limit: -10` flows to `core.search()` which may or may not handle it.

**Fix:** Clamp to 0 or throw INVALID_PARAMS for negative limits.

### 2. Search score tests assert hardcoded values

**Location:** `tests/unit/mcp/handlers.test.ts:87-94`

Tests assert `result[0]?.score === 1` and `result[1]?.score === 0.95`. These are implementation details of the fake score formula.

**Fix:** Assert relative ordering (`score[0] > score[1]`) not absolute values.

### 3. handleGetNode depth > 1 behavior undocumented

**Location:** `src/mcp/handlers.ts:89-98`

Implementation treats any truthy depth as "get neighbors". What happens with `depth: 100` or `depth: -1`? Undocumented.

**Fix:** Document behavior or validate depth is 0 or 1 only.

### 4. handleUpdateNode same title test is fragile

**Location:** `tests/unit/mcp/handlers.test.ts:583-596`

Test asserts `getNeighbors` NOT called for same title. Tests implementation detail rather than outcome.

**Fix:** Test outcome (no error when links exist + same title) rather than internal calls.

## Vector Provider

### 5. limit edge cases inconsistent

**Location:** `tests/unit/vector/sqlite.test.ts:203-214`

`limit: 0` and `limit: -5` both return `[]`. Sensible but undocumented. Inconsistent with `store()` which throws on empty vector.

**Fix:** Document behavior or throw for invalid limits.

### 6. Zero vector behavior undocumented

**Location:** `tests/unit/vector/sqlite.test.ts:276-288`

Returns distance 1 for zero vectors. Mathematically reasonable but semantically odd. Test validates behavior but doesn't document WHY.

**Fix:** Add comment explaining the choice.

### 7. Search order test depends on exact math

**Location:** `tests/unit/vector/sqlite.test.ts:68-78`

Uses unit vectors and asserts specific ordering. Float32 precision could drift across platforms.

**Fix:** Use larger differences in test vectors for robust ordering.

### 8. GraphCore.deleteNode swallows errors silently

**Location:** `src/core/graphcore.ts:124-131`

Catches any error and returns `false`. If `store.deleteNode()` throws for filesystem permission error, caller just sees `deleted: false` with no indication why.

**Fix:** Distinguish "not found" from other errors, or log the error.

## References

- Phase 10 red-team audit round 2 (2026-01-24)
