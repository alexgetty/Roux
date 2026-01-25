---
type: Issue
severity: Medium
component: MCP, Vector
phase: 10
---

# Issue - Red Team Round 3 Tech Debt

Medium-priority issues from Phase 10 red-team audit round 3.

## MCP Handlers

### 1. Wasteful double await pattern in tests

**Location:** `tests/unit/mcp/handlers.test.ts:101-102, 109-112, 315-318, 323-326`

Tests call handler twice to test both `toThrow` and `toMatchObject`. Should be single call:
```typescript
await expect(handleSearch(ctx, { query: 'test' })).rejects.toMatchObject({
  code: 'PROVIDER_ERROR',
});
```

**Fix:** Consolidate duplicate promise rejections.

### 2. handleUpdateNode content-only test missing

**Location:** `tests/unit/mcp/handlers.test.ts`

Tests exist for title-only, tags-only, and title-change scenarios, but no explicit test for content-only update to verify it doesn't trigger link integrity check.

**Fix:** Add test for content-only update path.

### 3. dispatchTool error propagation coverage shallow

**Location:** `tests/unit/mcp/handlers.test.ts:742-848`

Tests verify routing but don't test error propagation through dispatch. If a handler throws, does dispatchTool catch/wrap or propagate?

**Fix:** Add test for error propagation through dispatchTool.

## Vector Provider

### 4. Search dimension mismatch path fragile

**Location:** `tests/unit/vector/sqlite.test.ts`

No test for searching when database has vectors of different dimensions stored after overwrites. Current code hits first stored vector's dimension check.

**Fix:** Add test verifying behavior when mixed dimensions exist after overwrites.

### 5. Migration path test incomplete

**Location:** `tests/unit/vector/sqlite.test.ts:202-209`

Comment suggests model upgrade scenario but no end-to-end test: store old vectors, run migration (bulk overwrite), verify search works with new dimension across all vectors.

**Fix:** Add full migration scenario test.

### 6. cosineDistance edge cases untested

**Location:** `src/providers/vector/sqlite.ts`

Very small vectors like `[1e-40, 0, 0]` that might cause floating-point underflow aren't tested. Private function tested through search() behavior.

**Fix:** Low priority - add edge case if issues arise in production.

### 7. Unit tests don't verify embedding deletion

**Location:** `tests/unit/mcp/handlers.test.ts:676-699`

handleDeleteNode tests use mocked core.deleteNode that returns true/false, but never verify embedding deletion occurred. Correct for unit test scope, but no integration test in changed files verifies full deletion chain.

**Fix:** Add integration test for full deletion chain (Phase 11).

## References

- Phase 10 red-team audit round 3 (2026-01-24)
