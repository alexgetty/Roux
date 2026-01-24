---
type: Issue
severity: Medium
component: Graph Operations
phase: 5
---

# Issue - Negative Limit Handling

Undefined behavior for negative limit in `getNeighborIds`.

## Problem

Implementation at `src/graph/operations.ts:36-38`:

```typescript
if (options.limit !== undefined && options.limit < neighbors.length) {
  return neighbors.slice(0, options.limit);
}
```

If `limit: -1`:
- Condition is true (`-1 < neighbors.length` for any non-empty array)
- `neighbors.slice(0, -1)` returns all elements except the last

This is likely not intended behavior.

## Current Tests

- `limit: 1` → tested (line 63-68)
- `limit: 0` → tested, returns empty (line 70-73)
- `limit: -1` → not tested

## SqliteVectorProvider Comparison

`search()` handles this correctly at `sqlite.ts:53-55`:

```typescript
if (limit <= 0) {
  return [];
}
```

## Suggested Fix

```typescript
if (options.limit !== undefined) {
  if (options.limit <= 0) {
    return [];
  }
  if (options.limit < neighbors.length) {
    return neighbors.slice(0, options.limit);
  }
}
```

## Suggested Test

```typescript
it('returns empty array for negative limit', () => {
  const result = getNeighborIds(graph, 'a', { direction: 'out', limit: -1 });
  expect(result).toEqual([]);
});
```

## References

- `src/graph/operations.ts:13-41`
- `tests/unit/graph/operations.test.ts:37-82`
