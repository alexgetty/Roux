---
type: Issue
severity: High
component: EmbeddingProvider
phase: 6
---

# Issue - Embedding Input Validation

Missing tests for edge case inputs to `TransformersEmbeddingProvider`.

## 1. Empty String Input ✅ FIXED

~~What if `embed('')` is called?~~

**Status:** Test added in `transformers.test.ts:50-54`. Empty string produces valid 384-dim normalized vector (not zero vector). Behavior documented.

## 2. Very Long Input

Transformer models have token limits (~512 for MiniLM). What happens with 10,000+ character input?

```typescript
const embedding = await provider.embed('a'.repeat(10000));
```

Could:
- Silently truncate (common behavior)
- Throw an error
- Produce degraded output

## Risk

If `embed('')` produces a zero vector, `cosineDistance` returns 1.0 (no similarity) which may not be the intended behavior for empty documents.

## Suggested Tests

```typescript
describe('embed edge cases', () => {
  it('handles empty string input', async () => {
    const embedding = await provider.embed('');
    expect(embedding).toHaveLength(384);
    // Document expected behavior:
    // - Is it a zero vector?
    // - Is magnitude ~1 (normalized)?
  }, 60000);

  it('handles very long input', async () => {
    const longText = 'a'.repeat(10000);
    const embedding = await provider.embed(longText);
    expect(embedding).toHaveLength(384);
    // Verify it doesn't throw and produces valid output
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    expect(magnitude).toBeCloseTo(1, 1);
  }, 60000);
});
```

## References

- `src/providers/embedding/transformers.ts:24-28`
- `tests/unit/embedding/transformers.test.ts:45-64`
