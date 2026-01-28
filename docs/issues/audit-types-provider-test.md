---
tags:
  - test-audit
  - types
status: open
title: audit-types-provider-test
---

# Test Audit: types/provider.test.ts

## Summary

The test file covers `isVectorProvider` type guard adequately for basic cases but has significant gaps: no coverage for other provider interfaces (`StoreProvider`, `EmbeddingProvider`), no type assertion tests verifying TypeScript narrowing works correctly, and tests could pass by accident due to weak method signature verification.

## Findings

### [HIGH] No Coverage for StoreProvider or EmbeddingProvider Types

**Location:** `src/types/provider.ts:73-115`

**Problem:** The `provider.ts` file exports three major provider interfaces (`StoreProvider`, `EmbeddingProvider`, `VectorProvider`) but tests only cover `isVectorProvider`. There are no type guards for the other two interfaces, meaning there's no runtime validation available for the most important provider (`StoreProvider`).

**Evidence:**
```typescript
// src/types/provider.ts exports these interfaces with no runtime guards:
export interface StoreProvider { ... }  // 16 methods, no isStoreProvider guard
export interface EmbeddingProvider { ... }  // 4 methods, no isEmbeddingProvider guard
export interface VectorProvider { ... }  // 5 methods, HAS isVectorProvider guard
```

**Fix:** Either:
1. Add `isStoreProvider` and `isEmbeddingProvider` type guards with corresponding tests, OR
2. Document why only `VectorProvider` needs a runtime guard (possibly because it's the only one used in duck-typed contexts)

**Verification:** Check if consumers need to validate StoreProvider/EmbeddingProvider at runtime; if yes, add guards.

---

### [MEDIUM] Type Guard Only Checks Function Existence, Not Signature

**Location:** `tests/unit/types/provider.test.ts:17-18`, `src/types/provider.ts:131-136`

**Problem:** The type guard only verifies that properties are functions (`typeof obj.store === 'function'`) but doesn't verify arity or return types. An object with wrong-arity functions would pass the guard, potentially causing runtime errors later.

**Evidence:**
```typescript
// This would incorrectly pass isVectorProvider:
const badProvider = {
  store: () => 'not a promise',           // Wrong return type, wrong arity
  search: (x: string) => x,               // Wrong signature entirely
  delete: () => {},
  getModel: () => {},
  hasEmbedding: () => 'yes',              // Returns string, should be boolean
};
expect(isVectorProvider(badProvider)).toBe(true); // Would pass!
```

**Fix:** Add test cases that document this limitation explicitly, OR strengthen the guard to check `function.length` for arity. At minimum, add a comment in the test explaining the guard's limitations.

**Verification:** Add a test that demonstrates what the guard does NOT catch, with a comment explaining the design decision.

---

### [MEDIUM] Test Doesn't Verify Type Narrowing Actually Works

**Location:** `tests/unit/types/provider.test.ts:17-18`

**Problem:** The test verifies `isVectorProvider` returns `true` for valid providers, but doesn't verify that TypeScript actually narrows the type correctly in conditional blocks. This is the whole point of a type guard.

**Evidence:**
```typescript
// Current test only checks boolean return:
expect(isVectorProvider(validProvider)).toBe(true);

// Missing: verification that TypeScript narrows correctly:
const unknown: unknown = validProvider;
if (isVectorProvider(unknown)) {
  // TypeScript should now see `unknown` as VectorProvider
  // Test should call a method to prove narrowing worked
  unknown.hasEmbedding('test'); // This compile-time check isn't tested
}
```

**Fix:** Add a test that exercises the narrowed type:
```typescript
it('narrows type correctly for TypeScript', () => {
  const unknown: unknown = validProvider;
  if (isVectorProvider(unknown)) {
    // If this compiles, narrowing works
    expect(typeof unknown.hasEmbedding('test')).toBe('boolean');
  }
});
```

**Verification:** Test compiles and runs; TypeScript doesn't complain about accessing VectorProvider methods after guard.

---

### [MEDIUM] Line 21-38: Async Test Doesn't Verify Type Guard Behavior

**Location:** `tests/unit/types/provider.test.ts:21-38`

**Problem:** The test "returns true when methods return expected types" conflates two concerns: (1) verifying the type guard works, and (2) verifying provider methods return correct types. The second concern isn't the type guard's responsibility—the guard runs synchronously and can't check async return types.

**Evidence:**
```typescript
it('returns true when methods return expected types', async () => {
  // ...creates provider...
  expect(isVectorProvider(provider)).toBe(true); // Type guard check (sync)
  
  // These lines test the provider implementation, NOT the guard:
  const results = await provider.search([], 10);
  expect(results[0].id).toBe('node-1');
  // ^^ This is testing mock behavior, not isVectorProvider
});
```

**Fix:** Split into two tests:
1. `isVectorProvider` returns true for valid provider (sync, no async)
2. Separate integration test for provider method contracts (if needed)

**Verification:** Type guard tests should be purely synchronous.

---

### [LOW] Missing Test for Objects with Extra Properties

**Location:** `tests/unit/types/provider.test.ts`

**Problem:** No test verifies that objects with all required methods PLUS extra properties still pass the guard. This is expected structural typing behavior but worth documenting.

**Evidence:**
```typescript
// Not tested:
const extendedProvider = {
  ...validProvider,
  customMethod: () => {},
  extraProperty: 'extra',
};
expect(isVectorProvider(extendedProvider)).toBe(true);
```

**Fix:** Add test case documenting that extra properties don't disqualify a provider.

**Verification:** Test passes with extended object.

---

### [LOW] Missing Array/Function Boundary Cases

**Location:** `tests/unit/types/provider.test.ts:48-52`

**Problem:** Tests check primitives (string, number, boolean) but miss arrays and functions-as-values, which are also objects in JavaScript.

**Evidence:**
```typescript
// Not tested:
expect(isVectorProvider([])).toBe(false);
expect(isVectorProvider(() => {})).toBe(false);
expect(isVectorProvider(new Date())).toBe(false);
```

**Fix:** Add boundary tests for array, function, and built-in object types.

**Verification:** All return false.

---

### [LOW] Line 59: Destructuring Pattern May Be Fragile

**Location:** `tests/unit/types/provider.test.ts:59`

**Problem:** Using destructuring with `_` to exclude properties works but TypeScript's unused variable rule might complain depending on config. Also creates an implicit dependency on the property existing.

**Evidence:**
```typescript
const { store: _, ...noStore } = validProvider;
// ^^ If someone adds eslint no-unused-vars strict mode, this breaks
```

**Fix:** Consider using a utility function or explicit object construction for clarity:
```typescript
const noStore = {
  search: validProvider.search,
  delete: validProvider.delete,
  getModel: validProvider.getModel,
  hasEmbedding: validProvider.hasEmbedding,
};
```

**Verification:** Test remains readable without linter warnings.

## Related Issues

- [[type-guard-pattern-could-be-generic]] - discusses DRY concerns for type guards
- [[vector-provider-edge-cases]] - covers SqliteVectorProvider implementation gaps (different scope)
