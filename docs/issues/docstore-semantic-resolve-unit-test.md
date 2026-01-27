---
title: docstore-semantic-resolve-unit-test
tags:
  - medium
  - test-gap
  - docstore
---
# DocStore Semantic Resolve Unit Test Missing

**Severity:** Medium  
**Location:** `src/providers/docstore/index.ts:240-254`

## Problem

DocStore's `resolveNodes` method has a semantic strategy branch:

```typescript
if (strategy === 'exact' || strategy === 'fuzzy') {
  return this.cache.resolveNodes(names, options);
}
// Semantic strategy: use vector search
return names.map((query) => ({ query, match: null, score: 0 }));
```

The semantic branch is tested via MCP integration tests but lacks a dedicated unit test at DocStore level.

## Why Medium

- Behavior is correct
- Integration tests cover it
- Just missing a targeted unit test for completeness

## Recommended Fix

Add unit test in `tests/unit/docstore/docstore.test.ts`:

```typescript
describe('resolveNodes', () => {
  it('returns no match for semantic strategy (not supported at store level)', async () => {
    const result = await store.resolveNodes(['test'], { strategy: 'semantic' });
    expect(result[0]!.match).toBeNull();
    expect(result[0]!.score).toBe(0);
  });
});
```
