---
type: Issue
severity: Low
component: Testing
---

# GraphCore Provider Registration Tests

## Test Coverage Gap

Provider registration tests exist but don't cover all edge cases.

**Location:** `tests/unit/core/graphcore.test.ts:69-91`

## Current Coverage

- `registerStore` sets the store provider ✓
- `registerEmbedding` sets the embedding provider ✓
- Re-registration doesn't throw ✓

## Missing Tests

1. **Null/undefined registration** — What happens with `registerStore(null)`?
2. **Registration after use** — Register a new store after operations have been performed
3. **Provider replacement behavior** — When re-registering, is the old provider cleaned up?

## Suggested Tests

```typescript
it('throws when registering null store', () => {
  expect(() => core.registerStore(null as any)).toThrow();
});

it('throws when registering undefined embedding', () => {
  expect(() => core.registerEmbedding(undefined as any)).toThrow();
});

it('allows provider replacement', () => {
  const store1 = createMockStore();
  const store2 = createMockStore();

  core.registerStore(store1);
  core.registerStore(store2);

  // Operations should use store2
});
```

## References

- `tests/unit/core/graphcore.test.ts:69-91`
- `src/core/graphcore.ts` (registerStore, registerEmbedding)
