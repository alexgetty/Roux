---
tags:
  - consolidated
  - test-audit
  - types
  - validation
status: open
priority: critical
title: consolidated-type-guard-validation-gaps
---

# Consolidated: Type Guard Validation Gaps

## Problem Pattern
Type guards check top-level types but fail to validate nested structures, array element types, or optional field shapes. Invalid data passes runtime validation despite TypeScript's compile-time type annotations.

## Affected Locations

| File | Finding | Severity |
|------|---------|----------|
| tests/unit/types/node.test.ts | `isNode` does not validate `sourceRef` field when present | CRITICAL |
| tests/unit/types/node.test.ts | `properties` accepts arrays (`typeof [] === 'object'`) | HIGH |
| tests/unit/types/node.test.ts | `isSourceRef` accepts Invalid Date objects (`new Date('invalid')`) | HIGH |
| tests/unit/types/provider.test.ts | `isVectorProvider` only checks function existence, not signature | MEDIUM |
| tests/unit/types/provider.test.ts | No type guards for `StoreProvider` or `EmbeddingProvider` | HIGH |
| tests/unit/mcp/handlers.test.ts | `handleResolveNodes` doesn't validate array elements are strings | HIGH |
| tests/unit/mcp/handlers.test.ts | `handleNodesExist` doesn't validate `ids` array elements | HIGH |
| tests/unit/embedding/transformers.test.ts | Interface compliance test is compile-time only | CRITICAL |

## Root Cause Analysis
Type guards are implemented as minimal runtime checks that verify existence and top-level type, but skip:
1. **Nested validation**: When a field is present, its shape isn't validated
2. **Array element types**: `Array.isArray()` is used without `array.every()` on elements
3. **Semantic validity**: Values that are technically the right type but semantically invalid (Invalid Date, empty string, NaN)

This allows malformed data to enter the system, causing downstream failures with unclear error messages.

## Fix Strategy

1. **Update `isNode` to validate `sourceRef`**:
   ```typescript
   // In src/types/node.ts
   if (obj['sourceRef'] !== undefined && !isSourceRef(obj['sourceRef'])) {
     return false;
   }
   ```

2. **Add `Array.isArray()` guard for `properties`**:
   ```typescript
   if (Array.isArray(obj['properties'])) {
     return false; // Arrays are objects but not valid properties
   }
   ```

3. **Validate Date objects are not Invalid Date**:
   ```typescript
   if (obj['lastModified'] instanceof Date && isNaN(obj['lastModified'].getTime())) {
     return false;
   }
   ```

4. **Add array element validation in handlers**:
   ```typescript
   if (!names.every(n => typeof n === 'string')) {
     throw new McpError('INVALID_PARAMS', 'names must contain only strings');
   }
   ```

5. **Add tests for each validation gap**:
   ```typescript
   it('returns false when sourceRef has invalid type', () => {
     expect(isNode({ ...validNode, sourceRef: { type: 'invalid' } })).toBe(false);
   });
   
   it('returns false when properties is an array', () => {
     expect(isNode({ ...validNode, properties: ['not', 'valid'] })).toBe(false);
   });
   ```

## Verification
1. Add failing tests first (TDD: red)
2. Update type guard implementations
3. Run tests (green)
4. Verify TypeScript compilation still works with stricter guards

## Source Audits
- [[audit-types-node-test]]
- [[audit-types-provider-test]]
- [[audit-mcp-handlers-test]]
- [[audit-embedding-transformers-test]]
