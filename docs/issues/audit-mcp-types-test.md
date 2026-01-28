---
title: audit-mcp-types-test
tags:
  - test-audit
  - mcp
status: open
---
# Test Audit: mcp/types.test.ts

**Consolidated into:** [[consolidated-weak-assertions]], [[consolidated-error-propagation-gaps]]

## Summary

The test file has significant structural mismatches with the implementation, misses the `NodeMetadataResponse` interface entirely, and several "type shape" tests provide zero runtime value since TypeScript already validates them at compile time.

## Findings

### [HIGH] NodeMetadataResponse Not Tested

**Location:** `src/mcp/types.ts:4-10`

**Problem:** The implementation exports `NodeMetadataResponse` which is the base interface for browsing operations. The test file doesn't import or test it at all.

**Evidence:**
```typescript
// src/mcp/types.ts:4-10
export interface NodeMetadataResponse {
  id: string;
  title: string;
  tags: string[];
  links: LinkInfo[];
  properties: Record<string, unknown>;
}
```

```typescript
// tests/unit/mcp/types.test.ts:3-12 - NOT imported
import type {
  NodeResponse,
  NodeWithContextResponse,
  SearchResultResponse,
  // NodeMetadataResponse is missing
```

**Fix:** Add test case for `NodeMetadataResponse` shape validation.

**Verification:** Import `NodeMetadataResponse` and add a test that constructs a valid object.

---

### [HIGH] `properties` Field Missing From All Response Tests

**Location:** `tests/unit/mcp/types.test.ts:59-74, 76-93`

**Problem:** Both `NodeMetadataResponse` and `NodeResponse` include `properties: Record<string, unknown>` but test objects omit this required field. The tests pass only because TypeScript type annotations are stripped at runtime—the assertion is checking a malformed object.

**Evidence:**
```typescript
// Test object (lines 60-66) - missing properties field
const response: NodeResponse = {
  id: 'test.md',
  title: 'Test',
  content: 'Content',
  tags: ['tag1'],
  links: [{ id: 'other.md', title: 'Other' }],
  // properties is REQUIRED but not present
};
```

```typescript
// Implementation (src/mcp/types.ts:13-15)
export interface NodeResponse extends NodeMetadataResponse {
  content: string;
}
// Inherits properties: Record<string, unknown> from NodeMetadataResponse
```

**Fix:** Add `properties: {}` or `properties: { customKey: 'value' }` to all `NodeResponse` and related test objects.

**Verification:** Add assertions for `response.properties` in each test.

---

### [HIGH] SearchResultResponse Content Is Optional, Test Treats As Required

**Location:** `tests/unit/mcp/types.test.ts:95-106`

**Problem:** Implementation defines `content?: string` (optional) but test constructs object with required `content`. This masks the fact that content-less responses are valid and should be tested.

**Evidence:**
```typescript
// src/mcp/types.ts:25-29
export interface SearchResultResponse extends NodeMetadataResponse {
  score: number;
  content?: string;  // OPTIONAL
}
```

```typescript
// Test (lines 96-103) - treats content as required
const response: SearchResultResponse = {
  id: 'test.md',
  title: 'Test',
  content: 'Content',  // But this is optional!
  tags: [],
  links: [],
  score: 0.89,
};
```

**Fix:** Add separate test for `SearchResultResponse` without `content` field.

**Verification:** Create test: `it('SearchResultResponse works without content', () => { ... })`

---

### [MEDIUM] McpError Stack Trace Not Tested

**Location:** `tests/unit/mcp/types.test.ts:14-38`

**Problem:** `McpError` extends `Error` and should have a proper stack trace for debugging. No test verifies this.

**Evidence:**
```typescript
// Only tests name, code, message, instanceof
it('creates error with code and message', () => {
  const error = new McpError('NODE_NOT_FOUND', 'Node xyz not found');
  expect(error.code).toBe('NODE_NOT_FOUND');
  expect(error.message).toBe('Node xyz not found');
  expect(error.name).toBe('McpError');
  // No stack trace assertion
});
```

**Fix:** Add assertion: `expect(error.stack).toBeDefined(); expect(error.stack).toContain('McpError');`

**Verification:** Run test, confirm stack trace includes error name and call site.

---

### [MEDIUM] Type-Only Tests Provide No Runtime Value

**Location:** `tests/unit/mcp/types.test.ts:58-149`

**Problem:** The "response type shapes" tests are type annotations that TypeScript validates at compile time. At runtime, they just assign objects and assert the values they just assigned. This doesn't test any actual behavior.

**Evidence:**
```typescript
// This test adds nothing - TypeScript already validates the type
it('NodeResponse has expected structure', () => {
  const response: NodeResponse = { ... };  // TypeScript validates here
  expect(response.id).toBe('test.md');     // Asserting what we just wrote
});
```

**Fix:** These tests should either:
1. Test runtime validation functions (if they exist)
2. Test that transformation functions produce valid shapes
3. Be deleted as redundant

If kept for documentation, add comment explaining they're compile-time type checks for IDE assistance.

**Verification:** Remove tests, run `tsc --noEmit` - type errors should appear if shapes are wrong.

---

### [LOW] No Test for McpError Thrown in try/catch

**Location:** `tests/unit/mcp/types.test.ts:14-55`

**Problem:** No test verifies `McpError` can be caught and its properties accessed in a realistic error handling flow.

**Evidence:** All tests construct `McpError` but none throw/catch it.

**Fix:** Add test:
```typescript
it('can be caught and converted to response', () => {
  try {
    throw new McpError('NODE_NOT_FOUND', 'Missing');
  } catch (e) {
    expect(e).toBeInstanceOf(McpError);
    if (e instanceof McpError) {
      expect(e.toResponse().error.code).toBe('NODE_NOT_FOUND');
    }
  }
});
```

**Verification:** Test passes, confirms real-world catch usage works.

---

### [LOW] NodeWithContextResponse Neighbors Not Tested With Content

**Location:** `tests/unit/mcp/types.test.ts:76-93`

**Problem:** Test uses empty arrays for neighbors. Implementation specifies `incomingNeighbors: NodeResponse[]` and `outgoingNeighbors: NodeResponse[]`—non-empty arrays should be tested.

**Evidence:**
```typescript
// Test (lines 83-84)
incomingNeighbors: [],
outgoingNeighbors: [],
```

**Fix:** Populate with at least one `NodeResponse` object in each array and assert structure.

**Verification:** Add assertion for `response.incomingNeighbors[0].content`.

---

## Summary Table

| Severity | Count | Category |
|----------|-------|----------|
| HIGH | 3 | Missing interface, missing fields, type mismatch |
| MEDIUM | 2 | Missing error tests, redundant tests |
| LOW | 2 | Missing coverage depth |

## References

- Implementation: `/Users/alex/Repos/Roux/src/mcp/types.ts`
- Test file: `/Users/alex/Repos/Roux/tests/unit/mcp/types.test.ts`
- Related issue: [[MCP Layer Gaps]]
