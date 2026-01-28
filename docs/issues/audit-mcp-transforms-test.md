---
title: audit-mcp-transforms-test
tags:
  - test-audit
  - mcp
  - issue
---
# Test Audit: mcp/transforms.test.ts

## Summary

The transforms test file has solid coverage of happy paths but lacks error handling tests, boundary condition tests, and has some assertions that pass by accident rather than by design. Several documented gaps in [[MCP Layer Gaps]] remain unaddressed in the test file.

## Findings

### [HIGH] nodeToResponse Missing Error Handling Test

**Location:** `tests/unit/mcp/transforms.test.ts:48-130` (entire `nodeToResponse` describe block)

**Problem:** No test verifies behavior when `store.resolveTitles` throws. The implementation does not wrap this call in try/catch, meaning a failing store will propagate errors up. This is probably intended behavior, but it's undocumented and untested.

**Evidence:** 
```typescript
// Implementation (transforms.ts:29)
const titles = await store.resolveTitles(linksToResolve);
// No try/catch wrapper

// Tests only mock success:
const store = createMockStore(titleMap);
// Never: (store.resolveTitles as ReturnType<typeof vi.fn>).mockRejectedValue(...)
```

**Fix:** Add test case:
```typescript
it('propagates error when resolveTitles rejects', async () => {
  const node = createNode({ outgoingLinks: ['link.md'] });
  const store = createMockStore();
  (store.resolveTitles as ReturnType<typeof vi.fn>).mockRejectedValue(
    new Error('Store unavailable')
  );
  await expect(nodeToResponse(node, store, 'primary')).rejects.toThrow('Store unavailable');
});
```

**Verification:** Test should pass if error propagation is the intended behavior; implementation should wrap in try/catch if graceful degradation is preferred.

---

### [HIGH] nodeToContextResponse Missing Error Handling Tests

**Location:** `tests/unit/mcp/transforms.test.ts:249-315`

**Problem:** No tests verify behavior when:
1. Primary node's `nodeToResponse` fails
2. Neighbor batch `nodesToResponses` fails
3. One of the parallel Promise.all branches fails

**Evidence:**
```typescript
// Implementation (transforms.ts:116-119)
const [incomingResponses, outgoingResponses] = await Promise.all([
  nodesToResponses(limitedIncoming, store, 'neighbor', true),
  nodesToResponses(limitedOutgoing, store, 'neighbor', true),
]);
// No error handling for partial failure

// Tests only mock success scenarios
```

**Fix:** Add test cases for error propagation through `nodeToContextResponse`.

**Verification:** Run tests, verify error surfaces correctly.

---

### [MEDIUM] Truncation Length Assertion Obscures Implementation

**Location:** `tests/unit/mcp/transforms.test.ts:92-95`

**Problem:** Test asserts `response.content.length` equals `TRUNCATION_LIMITS.primary`, but this is coincidentally correct. The actual behavior is:
- `truncateContent` returns `content.slice(0, limit - suffixLength) + suffix`
- Final length = `limit - suffixLength + suffixLength = limit`

The test passes but doesn't verify the suffix is included or that the content was actually truncated at the right boundary.

**Evidence:**
```typescript
// Test (line 93-94)
expect(response.content.length).toBe(TRUNCATION_LIMITS.primary);
expect(response.content.endsWith('... [truncated]')).toBe(true);

// These pass, but don't verify:
// 1. Content before suffix is exactly limit - suffix.length characters
// 2. Original content was preserved up to the boundary
```

**Fix:** Add explicit boundary verification:
```typescript
it('truncates content preserving characters up to boundary', async () => {
  const longContent = 'abcdefghij'.repeat(1000); // known content
  const node = createNode({ content: longContent });
  const store = createMockStore();
  
  const response = await nodeToResponse(node, store, 'primary');
  
  const suffix = '... [truncated]';
  const expectedContentLength = TRUNCATION_LIMITS.primary - suffix.length;
  expect(response.content.slice(0, expectedContentLength)).toBe(
    longContent.slice(0, expectedContentLength)
  );
});
```

**Verification:** Test explicitly verifies content preservation.

---

### [MEDIUM] Missing Boundary Tests for MAX_LINKS_TO_RESOLVE

**Location:** `tests/unit/mcp/transforms.test.ts:222-233`

**Problem:** Test only covers 150 links (well over limit). Missing tests for:
1. Exactly 100 links (at boundary)
2. Exactly 101 links (one over)
3. 99 links (one under)

**Evidence:**
```typescript
// Only test (lines 223-232)
const manyLinks = Array.from({ length: 150 }, ...);
// Should only include first 100 links
expect(responses[0]?.links).toHaveLength(100);
```

**Fix:** Add boundary tests:
```typescript
it('includes all links when exactly at MAX_LINKS_TO_RESOLVE', async () => {
  const exactLinks = Array.from({ length: MAX_LINKS_TO_RESOLVE }, (_, i) => `link-${i}.md`);
  // ...
});

it('truncates links when one over MAX_LINKS_TO_RESOLVE', async () => {
  const overByOne = Array.from({ length: MAX_LINKS_TO_RESOLVE + 1 }, (_, i) => `link-${i}.md`);
  // ...
});
```

**Verification:** All boundary conditions explicitly tested.

---

### [MEDIUM] hubsToResponses Missing Empty Array Test

**Location:** `tests/unit/mcp/transforms.test.ts:377-405`

**Problem:** No test for empty hubs array input.

**Evidence:**
```typescript
// Only tests with actual hubs:
const hubs: Array<[string, number]> = [
  ['hub1.md', 45],
  // ...
];
// Never: const hubs: Array<[string, number]> = [];
```

**Fix:**
```typescript
it('handles empty hubs array', async () => {
  const hubs: Array<[string, number]> = [];
  const store = createMockStore();
  
  const responses = await hubsToResponses(hubs, store);
  
  expect(responses).toEqual([]);
  expect(store.resolveTitles).toHaveBeenCalledWith([]);
});
```

**Verification:** Test passes, confirms graceful empty handling.

---

### [MEDIUM] nodesToSearchResults Missing All-Scores-Missing Test

**Location:** `tests/unit/mcp/transforms.test.ts:357-364`

**Problem:** Test `'defaults to 0 for missing scores'` only tests a single node with missing score. No test verifies multiple nodes all with missing scores.

**Evidence:**
```typescript
it('defaults to 0 for missing scores', async () => {
  const nodes = [createNode({ id: 'no-score.md' })]; // Only one node
  // ...
});
```

**Fix:** Add test with multiple nodes, all missing scores, to verify batch handling.

**Verification:** Confirm all results get score: 0.

---

### [LOW] Content Exactly At Truncation Boundary Untested

**Location:** `tests/unit/mcp/transforms.test.ts:86-105`

**Problem:** Tests only verify content over the limit. No test verifies content exactly at the limit is NOT truncated.

**Evidence:**
```typescript
// Tests content over limit (line 87):
const longContent = 'x'.repeat(TRUNCATION_LIMITS.primary + 100);

// Missing: content exactly at limit
const exactContent = 'x'.repeat(TRUNCATION_LIMITS.primary);
```

**Fix:**
```typescript
it('does not truncate content exactly at limit', async () => {
  const exactContent = 'x'.repeat(TRUNCATION_LIMITS.primary);
  const node = createNode({ content: exactContent });
  const store = createMockStore();
  
  const response = await nodeToResponse(node, store, 'primary');
  
  expect(response.content).toBe(exactContent);
  expect(response.content.endsWith('... [truncated]')).toBe(false);
});
```

**Verification:** Boundary behavior explicitly documented in test.

---

### [LOW] Empty Tags Array Not Explicitly Tested

**Location:** `tests/unit/mcp/transforms.test.ts` (entire file)

**Problem:** All `createNode` calls use default `tags: ['tag1']` or don't override tags. No explicit test for empty tags array.

**Evidence:**
```typescript
function createNode(overrides: Partial<Node> = {}): Node {
  return {
    // ...
    tags: ['tag1'], // Default always has one tag
    // ...
  };
}
```

**Fix:** Add explicit test with `tags: []` to document expected behavior.

**Verification:** Response correctly includes empty tags array.

---

### [LOW] pathToResponse Empty Path Is Documented Dead Code

**Location:** `tests/unit/mcp/transforms.test.ts:427-434`

**Problem:** Test validates `pathToResponse([])` returns `length: -1`, but this code path is unreachable in practice. Already noted in [[MCP Layer Gaps]] as "Dead Code".

**Evidence:**
```typescript
it('handles empty path', () => {
  const response = pathToResponse([]);
  expect(response).toEqual({
    path: [],
    length: -1, // This is unreachable in production
  });
});
```

**Fix:** Either:
1. Delete the test and throw on empty input (fail fast)
2. Keep test but add comment documenting it's defensive code

**Verification:** Pick one approach, document decision.

---

### [LOW] Mock Store Missing Type Safety

**Location:** `tests/unit/mcp/transforms.test.ts:16-34`

**Problem:** `createMockStore` returns a partial mock typed as full `StoreProvider`. If interface changes, these tests won't catch missing methods.

**Evidence:**
```typescript
function createMockStore(titleMap: Map<string, string> = new Map()): StoreProvider {
  return {
    resolveTitles: vi.fn().mockResolvedValue(titleMap),
    createNode: vi.fn(),
    // ... only mocks needed methods
  };
}
```

**Fix:** Use `vi.mocked<StoreProvider>()` or add type assertion to ensure all interface methods are stubbed.

**Verification:** TypeScript catches interface drift.

---

## Cross-References

- [[MCP Layer Gaps]] - Documents `pathToResponse` dead code and `nodeToContextResponse` error handling gaps
- [[mcp-handler-test-gaps-round-1]] - Related test gap patterns in handler tests
