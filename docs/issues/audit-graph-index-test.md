---
title: audit-graph-index-test
tags:
  - test-audit
  - graph
status: open
---
# Test Audit: graph/index.test.ts

**Consolidated into:** [[consolidated-weak-assertions]]

## Summary

The `index.test.ts` file only tests that barrel exports exist and are functions. It provides no behavioral coverage and could pass even if the re-exports pointed to completely broken modules or incorrect functions.

## Findings

### [MEDIUM] Export Tests Are Purely Existence Checks

**Location:** `tests/unit/graph/index.test.ts:13-46`

**Problem:** All 7 tests follow the same pattern: check `toBeDefined()` and `typeof === 'function'`. This verifies the exports exist but not that they're the correct functions. The tests would pass if the barrel accidentally exported entirely wrong implementations.

**Evidence:**
```typescript
it('exports buildGraph', () => {
  expect(buildGraph).toBeDefined();
  expect(typeof buildGraph).toBe('function');
});
```

This pattern repeats for all 7 exports.

**Fix:** Add a minimal smoke test that calls each function with trivial input to prove the export actually works. For example:

```typescript
it('exports buildGraph that actually builds graphs', () => {
  const graph = buildGraph([]);
  expect(graph.order).toBe(0);
});

it('exports getNeighborIds that accepts correct signature', () => {
  const graph = buildGraph([]);
  const result = getNeighborIds(graph, 'x', { direction: 'out' });
  expect(result).toEqual([]);
});
```

**Verification:** After fix, if `index.ts` re-exported a random function from another module, the tests would fail.

---

### [LOW] No Test for Export Completeness

**Location:** `tests/unit/graph/index.test.ts` (entire file)

**Problem:** The test file explicitly lists 7 exports to check. If a new function is added to `src/graph/index.ts`, nothing enforces that a corresponding test is added. There's no "catch-all" test that the barrel exports exactly what's expected.

**Evidence:** The barrel (`src/graph/index.ts`) currently exports:
- `buildGraph` from `./builder.js`
- `getNeighborIds`, `findPath`, `getHubs` from `./traversal.js`
- `computeCentrality` from `./analysis.js`
- `GraphManager`, `GraphNotReadyError` from `./manager.js`

If a developer adds a new export but forgets to test it, coverage stays at 100% but the export completeness isn't verified.

**Fix:** Add a test that imports `* as graphModule` and asserts the exact set of exported names:

```typescript
import * as graphModule from '../../../src/graph/index.js';

it('exports exactly the expected API', () => {
  const exportNames = Object.keys(graphModule).sort();
  expect(exportNames).toEqual([
    'GraphManager',
    'GraphNotReadyError',
    'buildGraph',
    'computeCentrality',
    'findPath',
    'getHubs',
    'getNeighborIds',
  ]);
});
```

**Verification:** Adding an unexpected export or removing one would fail this test.

---

### [LOW] GraphNotReadyError Tested as Function, Not Constructor/Error

**Location:** `tests/unit/graph/index.test.ts:43-46`

**Problem:** The test checks `typeof GraphNotReadyError === 'function'`, which is correct for a class constructor, but doesn't verify it's actually an Error class. The real tests in `manager.test.ts` cover this, but the index test provides no behavioral indication.

**Evidence:**
```typescript
it('exports GraphNotReadyError', () => {
  expect(GraphNotReadyError).toBeDefined();
  expect(typeof GraphNotReadyError).toBe('function');
});
```

**Fix:** Add a minimal instantiation check:

```typescript
it('exports GraphNotReadyError as an Error class', () => {
  const err = new GraphNotReadyError();
  expect(err).toBeInstanceOf(Error);
  expect(err.name).toBe('GraphNotReadyError');
});
```

**Verification:** If the export were accidentally swapped with a non-Error function, this test would catch it.

---

## Context

The individual module tests (`builder.test.ts`, `traversal.test.ts`, `analysis.test.ts`, `manager.test.ts`) provide thorough behavioral coverage. The `index.test.ts` file serves only to verify the barrel re-exports correctly, which it does minimally. The findings here are LOW to MEDIUM severity because the real coverage exists elsewhere - but the export tests add minimal value in their current form.

## Related Issues

- [[Graph Test Coverage]] - mentions missing barrel export test coverage (now exists, but weak)
