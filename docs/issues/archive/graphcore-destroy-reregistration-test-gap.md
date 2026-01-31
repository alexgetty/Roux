---
title: graphcore-destroy-reregistration-test-gap
tags:
  - issue
  - test-gap
  - graphcore
---
# GraphCore destroy() Re-registration Test Gap

**Priority:** Medium  
**Type:** test-gap

## Problem

`destroy()` is tested for idempotency (can call twice) and for clearing provider references, but no test verifies that fresh providers can be registered AFTER destroy.

## Evidence

```typescript
// graphcore.test.ts:270-281
it('is idempotent - safe to call multiple times', async () => {
  // ... only tests double-destroy doesn't throw
});
```

Missing: test that verifies you can register new providers after destroy and they work.

## Fix

Add test in `graphcore.test.ts`:

```typescript
it('allows re-registration after destroy', async () => {
  const core = new GraphCoreImpl();
  await core.registerStore(mockStore);
  await core.registerEmbedding(mockEmbedding);

  await core.destroy();

  // Should be able to register fresh providers
  const newStore = createMockStore({ id: 'new-store' });
  const newEmbedding = createMockEmbedding({ id: 'new-embedding' });

  await core.registerStore(newStore);
  await core.registerEmbedding(newEmbedding);

  // Verify new providers are active
  await core.search('test');
  expect(newEmbedding.embed).toHaveBeenCalled();
  expect(newStore.searchByVector).toHaveBeenCalled();
});
```

## Verification

Test passes.
