---
type: Issue
priority: High
component: MCP
status: open
title: Mcp Layer Gaps
tags:
  - issue
  - mcp
  - bug
severity: Medium
phase: 9
---

# MCP Layer Gaps

Outstanding issues from Phase 9 red-team audit. Updated after Phase 10 fixes.

## Fixed (Phase 10)

- ~~sanitizeFilename Empty Result~~ — Now returns `'untitled'` fallback
- ~~String Limit Coercion~~ — `coerceLimit()` helper added
- ~~Type Assertions Without Validation~~ — Runtime validation for `direction`, `metric`, `mode`
- ~~sanitizeFilename test coverage~~ — Tests added

## High Priority

### MCP Server Error Handling Untested

**Location:** `src/mcp/server.ts:308-344`

Entire `setupHandlers` block (~40 lines) marked `v8 ignore`. This is the MCP integration point where errors get wrapped and responses formatted. If it breaks, you won't know until production.

**Includes:**
- Error wrapping logic (lines 322-341)
- Non-Error rejection handling (line 333) — produces `'Unknown error'` with no context

**Fix:** Extract error handling into testable function, or add integration tests that exercise these paths.

## Medium Priority

### pathToResponse Dead Code

**Location:** `src/mcp/transforms.ts:138-142`, `tests/unit/mcp/transforms.test.ts:318-325`

`pathToResponse([])` returns `{ path: [], length: -1 }`. This is unreachable (handlers return `null` for no path), but the test validates it as expected behavior.

**Fix:** Either delete the empty-path branch or add explicit guard with throw.

### Neighbor Truncation Indicator

**Location:** `src/mcp/transforms.ts:84-85`

`slice(0, MAX_NEIGHBORS)` truncates to 20 neighbors but gives no indication that truncation occurred or which neighbors were prioritized.

**Fix:** Add `truncated: boolean` or `totalCount: number` to response.

### Missing Test Coverage

| Location | Gap |
|----------|-----|
| `transforms.test.ts` | No test for `nodeToContextResponse` when `resolveTitles` throws |
| `transforms.test.ts` | No test for `nodesToSearchResults` with missing score in map |
| `server.test.ts:76-80` | `close` test only checks "doesn't throw", not actual cleanup |
| `server.test.ts:82-102` | `start` test doesn't verify server is functional |

## Low Priority (Roadmap)

### Fake Search Scores

**Location:** `src/mcp/handlers.ts:57-59`

Score formula `1 - index * 0.05` is synthetic, unrelated to actual similarity. Acceptable for MVP but should use real scores from vector search when available.

### Unicode Truncation

**Location:** `src/mcp/truncate.ts`

`slice()` can cut mid-emoji or mid-surrogate pair. MVP acceptable; fix if LLM content includes heavy Unicode.

### JSON.stringify Edge Cases

**Location:** `src/mcp/server.ts:320`

`JSON.stringify(result, null, 2)` throws on circular references or BigInt. Unlikely in practice but no guard.

## References

- Phase 9 red-team audit (2026-01-24)
- Phase 10 red-team audit round 2 (2026-01-24)
