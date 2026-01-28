---
tags:
  - test-audit
  - mcp
status: open
title: audit-mcp-handlers-test
---

# Test Audit: mcp/handlers.test.ts

## Summary

Handler test coverage is thorough for happy paths and basic validation, but misses several edge cases around async error handling, type coercion boundaries, and integration with the transform layer. Most gaps are medium severity - they won't cause production failures but reduce confidence in edge case handling.

## Findings

### [HIGH] handleResolveNodes does not validate `names` array elements

**Location:** `handlers.ts:444-445`, `handlers.test.ts:1481-1489`

**Problem:** The handler checks if `names` is an array but never validates that elements are strings. Passing `[123, null, {}]` will reach `core.resolveNodes` unchecked.

**Evidence:**
```typescript
// handlers.ts:444-445
if (!Array.isArray(names)) {
  throw new McpError('INVALID_PARAMS', 'names is required and must be an array');
}
// No validation of element types - passes directly to core
return ctx.core.resolveNodes(names as string[], options);  // line 465
```

Test gap - no test for non-string elements:
```typescript
// handlers.test.ts:1481-1489 - only tests allow empty array
it('allows empty names array', async () => {
  // ...
});
// Missing: test for names containing non-strings
```

**Fix:** Add validation: `if (!names.every(n => typeof n === 'string')) { throw... }`. Add test analogous to `handleSearchByTags` which properly validates tag types (lines 686-695).

**Verification:** Add test `it('throws INVALID_PARAMS when names contain non-strings')` and run `npm test -- handlers.test.ts`.

---

### [HIGH] handleNodesExist does not validate `ids` array elements

**Location:** `handlers.ts:472-478`, `handlers.test.ts:1525-1533`

**Problem:** Same issue as `handleResolveNodes` - checks array but not element types. Passing `[123, null]` reaches store unchecked.

**Evidence:**
```typescript
// handlers.ts:472-478
if (!Array.isArray(ids)) {
  throw new McpError('INVALID_PARAMS', 'ids is required and must be an array');
}
const result = await ctx.store.nodesExist(ids as string[]);  // No element validation
```

**Fix:** Add element validation before calling store. Add corresponding test.

**Verification:** Add test `it('throws INVALID_PARAMS when ids contain non-strings')`.

---

### [MEDIUM] handleGetNode depth > 1 silently clamped to 1

**Location:** `handlers.ts:118-127`, `handlers.test.ts:259-275`

**Problem:** Depth coercion function clamps any value >= 1 to exactly 1, but tests only cover depth 0 and 1. Schema says `maximum: 1` but handler doesn't throw - it silently clamps. This is inconsistent behavior (compare to limit validation which throws for out-of-range).

**Evidence:**
```typescript
// handlers.ts:118-127
function coerceDepth(value: unknown): number {
  // ...
  return num >= 1 ? 1 : 0;  // Silently clamps 5 -> 1
}
```

No test verifies behavior for depth > 1:
```typescript
// Missing test:
// it('clamps depth > 1 to 1', async () => { ... })
```

**Fix:** Either throw `INVALID_PARAMS` for depth > 1 (consistent with limit) or document clamping behavior and add test.

**Verification:** Add test for `depth: 5` and verify it behaves as depth 1.

---

### [MEDIUM] handleSearch score calculation is untested for empty results

**Location:** `handlers.ts:110-113`, `handlers.test.ts:88-102`

**Problem:** Score calculation formula `1 - index * 0.05` produces scores for returned nodes, but edge case of zero results returns empty array without testing the scoring branch.

**Evidence:**
```typescript
// handlers.ts:110-113
nodes.forEach((node, index) => {
  scores.set(node.id, Math.max(0, 1 - index * 0.05));
});
```

Tests check scores for 2-result case but not:
- 0 results (empty Map passed to nodesToSearchResults)
- 21+ results (score goes negative before Math.max clamps)

**Fix:** Add tests for: (1) empty results return empty array, (2) 21+ results have score floor at 0.

**Verification:** Add test with mock returning 25 nodes, verify last scores are 0 not negative.

---

### [MEDIUM] transforms.ts errors not propagated through handlers

**Location:** `handlers.ts:106-116`, `handlers.test.ts`

**Problem:** `nodesToSearchResults`, `nodeToResponse`, etc. are async and can throw (e.g., if `store.resolveTitles` fails). No handler tests verify that transform-layer errors propagate correctly.

**Evidence:**
```typescript
// handlers.ts:115
return nodesToSearchResults(nodes, scores, ctx.store, includeContent);
// If store.resolveTitles throws inside nodesToSearchResults, does it propagate?
```

All handler tests mock `ctx.store.resolveTitles` to succeed. No tests for:
- `resolveTitles` throws → error propagates
- `resolveTitles` returns malformed data

**Fix:** Add tests where `(ctx.store.resolveTitles as Mock).mockRejectedValue(new Error('...'))` and verify error propagates.

**Verification:** Run test, confirm handler rejects with original error (not McpError wrap).

---

### [MEDIUM] handleCreateNode content validation inconsistency

**Location:** `handlers.ts:316-318`, `handlers.test.ts:932-938`

**Problem:** Handler validates content exists and is string, but allows empty string content. The test `'throws INVALID_PARAMS when content missing'` doesn't test empty string case explicitly.

**Evidence:**
```typescript
// handlers.ts:316-318
if (content === undefined || typeof content !== 'string') {
  throw new McpError('INVALID_PARAMS', 'content is required and must be a string');
}
// Empty string '' passes this check
```

Test only checks undefined:
```typescript
// handlers.test.ts:932-938
it('throws INVALID_PARAMS when content missing', async () => {
  await expect(
    handleCreateNode(ctx, { id: 'test.md' })
  ).rejects.toMatchObject({ code: 'INVALID_PARAMS' });
});
// Missing: test for content: ''
```

**Fix:** Add test for `{ id: 'test.md', content: '' }` - document whether empty content is valid.

**Verification:** Run test, confirm behavior is intentional.

---

### [MEDIUM] handleUpdateNode allows empty string updates

**Location:** `handlers.ts:362-368`, `handlers.test.ts:1095-1101`

**Problem:** Handler requires at least one of title/content/tags but doesn't validate against empty strings. `{ id: 'x.md', title: '' }` passes validation and reaches core.

**Evidence:**
```typescript
// handlers.ts:362-368
if (title === undefined && content === undefined && tagsRaw === undefined) {
  throw new McpError('INVALID_PARAMS', '...');
}
// title: '' is !== undefined, so passes check
```

No test for empty string fields:
```typescript
// Missing: it('allows/rejects empty title string')
```

**Fix:** Decide and test: should empty strings be rejected or allowed (to clear fields)?

**Verification:** Add test for `{ id: 'x.md', title: '' }`.

---

### [MEDIUM] coerceInt with minimum=0 edge case

**Location:** `handlers.ts:38-56`, `handlers.test.ts:1675-1712`

**Problem:** `coerceInt` tests cover `minValue: 1` (limit) and `minValue: 0` (offset) but don't verify behavior when value equals boundary exactly for all code paths.

**Evidence:**
```typescript
// handlers.test.ts:1705-1708
it('accepts value equal to minimum', () => {
  expect(coerceInt(1, 10, 1, 'limit')).toBe(1);
  expect(coerceInt(0, 10, 0, 'offset')).toBe(0);
});
```

Missing: `coerceInt(0, 10, 0, 'offset')` with string input `'0'` - tests only numeric 0.

**Fix:** Add test: `expect(coerceInt('0', 10, 0, 'offset')).toBe(0)`.

**Verification:** Add test, run suite.

---

### [LOW] dispatchTool tests use minimal mocking

**Location:** `handlers.test.ts:1536-1672`

**Problem:** All `dispatchTool` tests just verify the tool routes to the correct handler - they don't verify the handler actually does anything. Since individual handlers are tested separately this is acceptable, but there's no integration test verifying the full dispatch path works end-to-end.

**Evidence:**
```typescript
// handlers.test.ts:1546-1552
it('dispatches get_node tool', async () => {
  const ctx = createContext();
  const result = await dispatchTool(ctx, 'get_node', { id: 'test.md' });
  expect(result).toBeNull();  // Just checks handler ran
});
```

**Fix:** Consider one integration-style test per tool that verifies args transform correctly through dispatch.

**Verification:** Optional enhancement.

---

### [LOW] No concurrency tests for handlers

**Location:** All handlers

**Problem:** All handlers are async but tests run them sequentially. No tests verify handlers work correctly under concurrent invocation (race conditions in shared mocks could mask issues).

**Evidence:** All tests use fresh `createContext()` per test, never call handlers concurrently.

**Fix:** Consider adding one test that calls multiple handlers concurrently on shared context.

**Verification:** Optional enhancement.

---

### [LOW] Mock store missing methods in tests

**Location:** `handlers.test.ts:24-45`

**Problem:** `createMockStore` includes `nodesExist` but mock behavior differs from handler expectations. The mock returns `new Map()` by default, but tests override it per-test. This is fine but fragile - if a handler adds a new store method, tests may silently use undefined.

**Evidence:**
```typescript
// handlers.test.ts:42-43
nodesExist: vi.fn().mockResolvedValue(new Map()),
```

If store interface adds new method, `createMockStore()` won't include it, potentially causing runtime errors in tests that expect it.

**Fix:** Consider using `satisfies StoreProvider` or type-checking the mock factory.

**Verification:** TypeScript would catch this on interface change.

---

## Previously Documented (Already in docs/issues/)

The following gaps were already identified in existing issues and are not duplicated here:

- Dynamic imports for `handleListNodes` etc. → `mcp-handler-test-gaps-round-1.md`
- Inconsistent error message assertions → `mcp-handler-test-gaps-round-1.md`
- searchByTags limit not pushed to SQL → `mcp-contract-violations-audit.md`
- list_nodes path filter case sensitivity → `mcp-contract-violations-audit.md`
