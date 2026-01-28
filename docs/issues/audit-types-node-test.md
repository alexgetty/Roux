---
title: audit-types-node-test
tags:
  - test-audit
  - types
status: open
---
# Test Audit: types/node.test.ts

> **Consolidated into:** [[consolidated-type-guard-validation-gaps]]

## Summary

The test file covers basic happy/unhappy paths for `isNode` and `isSourceRef` type guards but misses critical validation gaps where the guards accept invalid data, and lacks coverage for the `NodeWithContext` interface entirely.

## Findings

### [CRITICAL] isNode Does Not Validate sourceRef

**Location:** `src/types/node.ts:29-68` (implementation), `tests/unit/types/node.test.ts:18-28` (test)

**Problem:** The `isNode` function does not validate the `sourceRef` field. When `sourceRef` is present, it is accepted without any type checking. A node with `sourceRef: { type: 'garbage', foo: 123 }` will pass `isNode`, contradicting the `SourceRef` type contract.

**Fix:** 
1. Add implementation: if `obj['sourceRef'] !== undefined`, validate it with `isSourceRef(obj['sourceRef'])`
2. Add tests for `isNode` with invalid sourceRef values

---

### [HIGH] properties Accepts Arrays

**Location:** `src/types/node.ts:44-45`, `tests/unit/types/node.test.ts:103-109`

**Problem:** The properties validation uses `typeof obj['properties'] !== 'object'` which passes arrays since `typeof [] === 'object'`. A node with `properties: ['a', 'b']` will incorrectly pass validation.

**Fix:**
1. Add `Array.isArray(obj['properties'])` check to implementation
2. Add test: `expect(isNode({ ...validNode, properties: [] })).toBe(false)`

---

### [HIGH] isSourceRef Accepts Invalid Date Objects

**Location:** `src/types/node.ts:80`, `tests/unit/types/node.test.ts:219-222`

**Problem:** The `lastModified` validation uses `instanceof Date`, but `new Date('invalid')` creates a Date object with `NaN` time value. This is an invalid date that would pass the guard but cause runtime issues.

**Fix:**
1. Add implementation check: `!isNaN(obj['lastModified'].getTime())` after instanceof check
2. Add test: `expect(isSourceRef({ type: 'file', lastModified: new Date('invalid') })).toBe(false)`

---

### [MEDIUM] No Type Guard for NodeWithContext

**Problem:** The `NodeWithContext` interface extends `Node` with `neighbors`, `incomingCount`, and `outgoingCount` fields, but no type guard function exists.

---

### [MEDIUM] Missing Test for isNode with Malformed sourceRef

**Problem:** Tests only verify `isNode` with a VALID sourceRef. No test verifies behavior when sourceRef is present but invalid.
