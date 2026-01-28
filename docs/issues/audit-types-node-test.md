---
tags:
  - test-audit
  - types
status: open
title: audit-types-node-test
---

# Test Audit: types/node.test.ts

## Summary

The test file covers basic happy/unhappy paths for `isNode` and `isSourceRef` type guards but misses critical validation gaps where the guards accept invalid data, and lacks coverage for the `NodeWithContext` interface entirely.

## Findings

### [CRITICAL] isNode Does Not Validate sourceRef

**Location:** `src/types/node.ts:29-68` (implementation), `tests/unit/types/node.test.ts:18-28` (test)

**Problem:** The `isNode` function does not validate the `sourceRef` field. When `sourceRef` is present, it is accepted without any type checking. A node with `sourceRef: { type: 'garbage', foo: 123 }` will pass `isNode`, contradicting the `SourceRef` type contract.

**Evidence:**
```typescript
// Implementation has NO sourceRef validation:
export function isNode(value: unknown): value is Node {
  // ... validates id, title, content, tags, outgoingLinks, properties, plugins
  // sourceRef is NEVER checked
  return true;
}

// Test assumes this works but doesn't verify rejection of invalid sourceRef:
it('returns true for node with sourceRef', () => {
  const nodeWithRef: Node = {
    ...validNode,
    sourceRef: { type: 'file', path: '/path/to/file.md', lastModified: new Date() },
  };
  expect(isNode(nodeWithRef)).toBe(true);  // Only tests valid case
});
```

**Fix:** 
1. Add implementation: if `obj['sourceRef'] !== undefined`, validate it with `isSourceRef(obj['sourceRef'])`
2. Add tests for `isNode` with invalid sourceRef values (wrong type, missing type field, etc.)

**Verification:** Test that `isNode({ ...validNode, sourceRef: { type: 'invalid' } })` returns `false`

---

### [HIGH] properties Accepts Arrays

**Location:** `src/types/node.ts:44-45`, `tests/unit/types/node.test.ts:103-109`

**Problem:** The properties validation uses `typeof obj['properties'] !== 'object'` which passes arrays since `typeof [] === 'object'`. A node with `properties: ['a', 'b']` will incorrectly pass validation.

**Evidence:**
```typescript
// Implementation:
typeof obj['properties'] !== 'object' ||
obj['properties'] === null

// typeof [] === 'object', so arrays pass this check

// Existing test only covers string and null:
it('returns false when properties is not an object', () => {
  expect(isNode({ ...validNode, properties: 'not-object' })).toBe(false);
});
it('returns false when properties is null', () => {
  expect(isNode({ ...validNode, properties: null })).toBe(false);
});
// NO test for properties: []
```

**Fix:**
1. Add `Array.isArray(obj['properties'])` check to implementation (similar to plugins validation)
2. Add test: `expect(isNode({ ...validNode, properties: [] })).toBe(false)`

**Verification:** Test that `isNode({ ...validNode, properties: ['array'] })` returns `false`

---

### [HIGH] isSourceRef Accepts Invalid Date Objects

**Location:** `src/types/node.ts:80`, `tests/unit/types/node.test.ts:219-222`

**Problem:** The `lastModified` validation uses `instanceof Date`, but `new Date('invalid')` creates a Date object with `NaN` time value. This is an invalid date that would pass the guard but cause runtime issues.

**Evidence:**
```typescript
// Implementation:
obj['lastModified'] === undefined || obj['lastModified'] instanceof Date

// new Date('invalid') instanceof Date === true
// new Date('invalid').getTime() === NaN

// Tests only check non-Date types:
it('returns false when lastModified is not a Date', () => {
  expect(isSourceRef({ type: 'file', lastModified: '2024-01-01' })).toBe(false);
  expect(isSourceRef({ type: 'file', lastModified: 1234567890 })).toBe(false);
});
// NO test for Invalid Date object
```

**Fix:**
1. Add implementation check: `!isNaN(obj['lastModified'].getTime())` after instanceof check
2. Add test: `expect(isSourceRef({ type: 'file', lastModified: new Date('invalid') })).toBe(false)`

**Verification:** Test that `isSourceRef({ type: 'file', lastModified: new Date('not-a-date') })` returns `false`

---

### [MEDIUM] No Type Guard for NodeWithContext

**Location:** `src/types/node.ts:22-27`

**Problem:** The `NodeWithContext` interface extends `Node` with `neighbors`, `incomingCount`, and `outgoingCount` fields, but no type guard function exists. Consumers cannot safely narrow unknown values to `NodeWithContext`.

**Evidence:**
```typescript
// Interface exists:
export interface NodeWithContext extends Node {
  neighbors?: Node[];
  incomingCount?: number;
  outgoingCount?: number;
}

// No isNodeWithContext function exists
// No tests exist for this interface
```

**Fix:**
1. Implement `isNodeWithContext` that validates base Node + optional extension fields
2. Add test coverage for `isNodeWithContext` guard

**Verification:** Create and test `isNodeWithContext` function

---

### [MEDIUM] Missing Test for isNode with Malformed sourceRef

**Location:** `tests/unit/types/node.test.ts:18-28`

**Problem:** Tests only verify `isNode` with a VALID sourceRef. No test verifies behavior when sourceRef is present but invalid. This masks the CRITICAL bug above.

**Evidence:**
```typescript
// Only test for sourceRef:
it('returns true for node with sourceRef', () => {
  const nodeWithRef: Node = { ...validNode, sourceRef: { type: 'file', ... } };
  expect(isNode(nodeWithRef)).toBe(true);
});

// Missing tests:
// - isNode with sourceRef: { type: 'invalid' }
// - isNode with sourceRef: { foo: 'bar' }
// - isNode with sourceRef: 'string'
// - isNode with sourceRef: []
```

**Fix:** Add negative test cases for various malformed sourceRef values

**Verification:** Tests should fail until CRITICAL fix is applied

---

### [LOW] Test Names Inconsistent with Behavior

**Location:** `tests/unit/types/node.test.ts:136-140`

**Problem:** Test at line 136 says "returns false when plugins is not an object" but tests multiple types in one assertion block. Harder to debug when one case fails.

**Evidence:**
```typescript
it('returns false when plugins is not an object', () => {
  expect(isNode({ ...validNode, plugins: 'not-object' })).toBe(false);
  expect(isNode({ ...validNode, plugins: [] })).toBe(false);  // array IS object type
  expect(isNode({ ...validNode, plugins: 42 })).toBe(false);
});
```

**Fix:** Split into separate test cases or rename to "returns false when plugins is invalid"

**Verification:** Better test failure messages

## Reviewed

- [x] isNode type guard
- [x] isSourceRef type guard
- [x] Edge cases
- [x] Error paths
- [x] NodeWithContext coverage
- [x] sourceRef validation in isNode
