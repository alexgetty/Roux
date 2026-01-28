---
tags:
  - test-audit
  - embedding
status: open
title: audit-embedding-transformers-test
---

# Test Audit: embedding/transformers.test.ts

## Summary

The TransformersEmbeddingProvider test suite covers basic functionality but has critical gaps in interface validation, error handling, consistency checks, and relies on timing-based assertions that are inherently flaky.

## Findings

### [CRITICAL] Interface Compliance Test Provides No Real Verification

**Location:** `tests/unit/embedding/transformers.test.ts:17-20`

**Problem:** The test assigns the provider to a typed variable and asserts `toBeDefined()`. This only verifies TypeScript compile-time types, not runtime behavior. If a method is missing or has the wrong signature at runtime, this test still passes.

**Evidence:**
```typescript
it('implements EmbeddingProvider interface', () => {
  const _check: EmbeddingProvider = provider;
  expect(_check).toBeDefined();
});
```

**Fix:** Test that each method exists and is callable:
```typescript
it('implements EmbeddingProvider interface', () => {
  expect(typeof provider.embed).toBe('function');
  expect(typeof provider.embedBatch).toBe('function');
  expect(typeof provider.dimensions).toBe('function');
  expect(typeof provider.modelId).toBe('function');
});
```

**Verification:** Mock a broken provider missing a method and confirm test fails.

---

### [HIGH] No Error Handling Tests

**Location:** `tests/unit/embedding/transformers.test.ts` (entire file)

**Problem:** Implementation at `src/providers/embedding/transformers.ts` has no explicit error handling, and tests don't verify behavior when the underlying `@xenova/transformers` pipeline fails. Network errors during model download, corrupted model cache, or WASM failures are all unhandled.

**Evidence:** Grep for `throw|Error|reject` in implementation returns no matches. Test file has no `.rejects` assertions.

**Fix:** Add tests for failure scenarios:
```typescript
it('throws when pipeline initialization fails', async () => {
  // Mock pipeline to throw
  vi.mock('@xenova/transformers', () => ({
    pipeline: vi.fn().mockRejectedValue(new Error('Network error'))
  }));
  const provider = new TransformersEmbeddingProvider();
  await expect(provider.embed('test')).rejects.toThrow();
});
```

**Verification:** Temporarily break the model name in tests and confirm behavior is documented.

---

### [HIGH] embedBatch() Consistency With embed() Untested

**Location:** `tests/unit/embedding/transformers.test.ts:83-102`

**Problem:** No test verifies that `embedBatch(['text'])` produces the same result as `embed('text')`. Implementation at line 34 shows `embedBatch` calls `Promise.all(texts.map(t => this.embed(t)))`, but if this changes, nothing catches drift.

**Evidence:**
```typescript
async embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  return Promise.all(texts.map((t) => this.embed(t)));
}
```

**Fix:**
```typescript
it('embedBatch([x]) equals [embed(x)]', async () => {
  const single = await provider.embed('consistency test');
  const batch = await provider.embedBatch(['consistency test']);
  expect(batch[0]).toEqual(single);
});
```

**Verification:** Change implementation to use a different pooling strategy in batch mode; test should fail.

---

### [MEDIUM] Pipeline Caching Test Is Timing-Based (Flaky)

**Location:** `tests/unit/embedding/transformers.test.ts:133-141`

**Problem:** The test asserts `elapsed < 5000` to prove caching works. This is environment-dependent and can fail on slow CI runners or pass incorrectly on fast machines even without caching.

**Evidence:**
```typescript
it('reuses pipeline across multiple calls', async () => {
  const p = new TransformersEmbeddingProvider();
  await p.embed('first call');
  const start = performance.now();
  await p.embed('second call');
  const elapsed = performance.now() - start;
  expect(elapsed).toBeLessThan(5000);  // Arbitrary threshold
}, 60000);
```

**Fix:** Use a spy/mock to verify `pipeline()` is called exactly once:
```typescript
it('reuses pipeline across multiple calls', async () => {
  const pipelineSpy = vi.spyOn(transformers, 'pipeline');
  const p = new TransformersEmbeddingProvider();
  await p.embed('first');
  await p.embed('second');
  await p.embed('third');
  expect(pipelineSpy).toHaveBeenCalledTimes(1);
});
```

**Verification:** Remove caching logic from implementation; test should fail with call count > 1.

---

### [MEDIUM] Identical Text Similarity Untested

**Location:** `tests/unit/embedding/transformers.test.ts:104-130`

**Problem:** Semantic similarity tests check "high" (> 0.5) for similar text and "low" (< 0.5) for dissimilar, but don't verify the fundamental case: identical text should produce similarity ~1.0.

**Evidence:** The similarity section has only two tests, neither with identical inputs.

**Fix:**
```typescript
it('identical texts have similarity approximately 1', async () => {
  const [e1, e2] = await provider.embedBatch([
    'The exact same sentence',
    'The exact same sentence',
  ]);
  expect(cosineSimilarity(e1, e2)).toBeCloseTo(1, 2);
});
```

**Verification:** Should always pass; documents expected behavior for identical inputs.

---

### [MEDIUM] Determinism Untested

**Location:** `tests/unit/embedding/transformers.test.ts` (missing)

**Problem:** No test verifies that calling `embed('text')` twice returns identical vectors. Consumers may rely on deterministic behavior for caching or deduplication.

**Evidence:** No test calls `embed()` twice with the same input and compares results.

**Fix:**
```typescript
it('produces deterministic embeddings', async () => {
  const first = await provider.embed('determinism test');
  const second = await provider.embed('determinism test');
  expect(first).toEqual(second);
});
```

**Verification:** If model has non-deterministic behavior, test documents it.

---

### [LOW] Unicode and Special Character Input Untested

**Location:** `tests/unit/embedding/transformers.test.ts:45-81`

**Problem:** Tests use ASCII text only. No coverage for Unicode (CJK, emoji, RTL), special characters, or mixed scripts.

**Evidence:** All test strings are basic ASCII: 'test text', 'hello world', 'a'.repeat(10000).

**Fix:**
```typescript
it('handles unicode input', async () => {
  const embedding = await provider.embed('こんにちは 🚀 مرحبا');
  expect(embedding).toHaveLength(384);
  expect(embedding.every(v => Number.isFinite(v))).toBe(true);
});
```

**Verification:** Ensures model doesn't crash on international text.

---

### [LOW] Single-Item Batch Untested

**Location:** `tests/unit/embedding/transformers.test.ts:83-102`

**Problem:** `embedBatch` tests use arrays of 2, 3, and 0 items. No test for single-item array `[text]`.

**Evidence:** Tests at lines 84-96 use `['first text', 'second text', 'third text']` and `['alpha', 'beta']`.

**Fix:**
```typescript
it('handles single-item batch', async () => {
  const embeddings = await provider.embedBatch(['only one']);
  expect(embeddings).toHaveLength(1);
  expect(embeddings[0]).toHaveLength(384);
});
```

**Verification:** Edge case coverage for batch with length 1.

---

### [LOW] Custom Dimensions Without embed() Call

**Location:** `tests/unit/embedding/transformers.test.ts:39-42`

**Problem:** Custom dimensions test creates provider with `dimensions = 768` but never calls `embed()`. The `dimensions()` method just returns the constructor argument; it doesn't verify the model actually produces that dimension.

**Evidence:**
```typescript
it('returns custom dimensions when specified', () => {
  const custom = new TransformersEmbeddingProvider('Xenova/some-model', 768);
  expect(custom.dimensions()).toBe(768);  // Just returns what was passed in
});
```

**Fix:** Either document that `dimensions()` is advisory/configurable, or add a test that calls `embed()` with a real 768-dim model (e.g., `Xenova/paraphrase-MiniLM-L6-v2`) and verifies output length.

**Verification:** Clarifies the contract of `dimensions()` method.

---

## Summary Table

| Severity | Finding | Line |
|----------|---------|------|
| CRITICAL | Interface compliance is compile-time only | 17-20 |
| HIGH | No error handling tests | - |
| HIGH | embedBatch/embed consistency untested | 83-102 |
| MEDIUM | Pipeline caching uses timing assertion | 133-141 |
| MEDIUM | Identical text similarity untested | 104-130 |
| MEDIUM | Determinism untested | - |
| LOW | Unicode input untested | 45-81 |
| LOW | Single-item batch untested | 83-102 |
| LOW | Custom dimensions never verified via embed | 39-42 |
