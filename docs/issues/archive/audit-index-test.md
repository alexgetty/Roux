---
id: E--Y9QkDL6FE
title: audit-index-test
tags:
  - test-audit
  - exports
---
# Test Audit: index.test.ts

**Consolidated into:** [[consolidated-weak-assertions]]

## Summary

The barrel export test (`tests/unit/index.test.ts`) tests only VERSION, ignoring 95% of exports including all core classes, providers, and re-exported types. A single regex assertion provides no confidence that the public API works.

## Findings

### [CRITICAL] No Coverage of Core Exports

**Location:** `src/index.ts:6-14`

**Problem:** The test file only checks `VERSION`. The barrel exports:
- `GraphCoreImpl` (core orchestrator)
- `DocStore` (primary store provider)
- `TransformersEmbeddingProvider` (embedding provider)
- `SqliteVectorProvider` (vector provider)
- All types from `./types/index.js`

None of these are verified to be exported correctly.

**Evidence:**
```typescript
// src/index.ts
export const VERSION = '0.1.3';
export * from './types/index.js';
export { GraphCoreImpl } from './core/graphcore.js';
export { DocStore } from './providers/docstore/index.js';
export { TransformersEmbeddingProvider } from './providers/embedding/index.js';
export { SqliteVectorProvider } from './providers/vector/index.js';

// tests/unit/index.test.ts (ENTIRE FILE)
import { VERSION } from '../../src/index.js';
describe('roux', () => {
  it('exports VERSION as semver string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
```

**Fix:** Add import assertions for all named exports:
```typescript
import {
  VERSION,
  GraphCoreImpl,
  DocStore,
  TransformersEmbeddingProvider,
  SqliteVectorProvider,
  // type guards
  isNode,
  isSourceRef,
  isVectorProvider,
  // constants
  DEFAULT_CONFIG,
} from '../../src/index.js';

it('exports all core classes', () => {
  expect(GraphCoreImpl).toBeDefined();
  expect(DocStore).toBeDefined();
  expect(TransformersEmbeddingProvider).toBeDefined();
  expect(SqliteVectorProvider).toBeDefined();
});

it('exports type guards', () => {
  expect(typeof isNode).toBe('function');
  expect(typeof isSourceRef).toBe('function');
  expect(typeof isVectorProvider).toBe('function');
});

it('exports DEFAULT_CONFIG', () => {
  expect(DEFAULT_CONFIG).toBeDefined();
  expect(DEFAULT_CONFIG.source).toBeDefined();
});
```

**Verification:** Run `npm test -- tests/unit/index.test.ts` and confirm all export assertions pass.

---

### [HIGH] VERSION Test Doesn't Verify Actual Value

**Location:** `tests/unit/index.test.ts:5-7`

**Problem:** The test only checks that VERSION matches a semver pattern. It doesn't verify the actual version matches `package.json`, so VERSION could drift without detection.

**Evidence:**
```typescript
it('exports VERSION as semver string', () => {
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
});
// VERSION = '99.99.99' would pass this test
```

**Fix:** Import version from package.json and assert equality:
```typescript
import pkg from '../../package.json' with { type: 'json' };

it('exports VERSION matching package.json', () => {
  expect(VERSION).toBe(pkg.version);
});
```

**Verification:** Change VERSION to a wrong value and confirm the test fails.

---

### [MEDIUM] No Type Export Verification

**Location:** `src/index.ts:6` (`export * from './types/index.js'`)

**Problem:** The wildcard re-export could silently break (e.g., if `types/index.ts` stops exporting something) and the test wouldn't catch it. Type-only exports can't be directly tested, but type guards and constants from types can.

**Evidence:** `src/types/index.ts` exports:
- Type guards: `isNode`, `isSourceRef`, `isVectorProvider`
- Constants: `DEFAULT_CONFIG`

None are tested for re-export.

**Fix:** Verify runtime exports from types module:
```typescript
it('re-exports type guards from types', () => {
  expect(isNode).toBeDefined();
  expect(isSourceRef).toBeDefined();
  expect(isVectorProvider).toBeDefined();
});

it('re-exports DEFAULT_CONFIG from types', () => {
  expect(DEFAULT_CONFIG).toBeDefined();
});
```

**Verification:** Remove one re-export from `src/types/index.ts`, run test, confirm failure.

---

### [LOW] Test Suite Name is Generic

**Location:** `tests/unit/index.test.ts:4`

**Problem:** The describe block is named `'roux'` which is vague. Other test files use more specific names tied to what they're testing.

**Evidence:**
```typescript
describe('roux', () => {
```

**Fix:** Use a more specific name:
```typescript
describe('barrel exports (src/index.ts)', () => {
```

**Verification:** Visual inspection after change.
