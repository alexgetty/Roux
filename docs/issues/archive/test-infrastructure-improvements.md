---
type: '[[Tech Debt]]'
priority: Low
component: '[[Testing]]'
status: open
title: Test Infrastructure Improvements
tags:
  - issue
  - testing
  - tech-debt
  - infrastructure
---

# Test Infrastructure Improvements

Collection of test quality issues that add maintenance burden.

## 1. Duplicated Mock Helpers

**Location:** `tests/unit/mcp/handlers.test.ts`, `tests/unit/mcp/server.test.ts`

`createMockStore` and `createMockCore` duplicated across files.

**Fix:** Extract to `tests/fixtures/mocks.ts`.

## 2. Magic Numbers for Tool Count

**Location:** `tests/unit/mcp/server.test.ts:140-151`

Asserts `12` and `13` tools as literals. Adding a tool requires updating two places.

**Fix:** Use `Object.keys(TOOL_SCHEMAS).length` or similar.

## 3. Inconsistent Test Timeouts

**Location:** `tests/integration/watcher/file-events.test.ts`

Tests use 5000-8000ms timeouts without explaining why. Mix of real timers and fake timers across watcher tests.

**Fix:** Add timeout comment block at top of integration files:
```typescript
// Timeouts: chokidar stability (100ms) + debounce (1000ms) + CI buffer
```

## 4. Hardcoded Score Assertions

**Location:** `tests/unit/mcp/handlers.test.ts:80-95`

Tests assert `score === 0.95` which encodes the fake formula `1 - index * 0.05`.

**Fix:** Assert `score[0] > score[1]` (relative ordering) not absolute values.

## 5. Double-Await Pattern

**Location:** `tests/unit/mcp/handlers.test.ts:101-102, 109-112`

Tests call handler twice to test both `toThrow` and `toMatchObject`.

**Fix:** Use single call with `rejects.toMatchObject`.

## References

- Red team rounds 2-10 (various)
