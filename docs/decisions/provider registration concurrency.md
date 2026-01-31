---
title: provider registration concurrency
tags:
  - decision
  - architecture
---
# Provider Registration Concurrency

## Decision

Operations during provider registration are **undefined behavior**. Callers must not call GraphCore methods (`search`, `getNode`, etc.) while `registerStore` or `registerEmbedding` is in progress.

## Context

Provider registration follows this sequence:

```typescript
// graphcore.ts
this.store = provider;           // 1. Provider reference set
if (provider.onRegister) {
  await provider.onRegister();   // 2. Async initialization
}
```

This ordering is intentional: `onRegister` may need to call back into GraphCore (e.g., to populate initial data). Setting the reference first enables this.

However, if external code calls `search()` between steps 1 and 2, it operates on a partially-initialized provider.

## Alternatives Considered

**Mutex/lock on all operations**
- Pro: Guarantees safety
- Con: Adds latency to every operation (99.9% case) for an edge case (0.1%)
- Con: Deadlocks if `onRegister` calls GraphCore methods

**Two-phase registration with `isReady()` check**
- Pro: Explicit state machine
- Con: Complexity for marginal benefit
- Con: Every operation pays the check cost

**Document and move on**
- Pro: Simple, no runtime cost
- Con: Footgun for careless callers

## Rationale

Registration happens at startup, before any operations. The scenario of concurrent registration + operations is:
1. Rare in practice
2. A programming error, not a runtime condition
3. Best addressed by documentation, not runtime guards

Adding synchronization would penalize all operations for an edge case that indicates misuse.

## Consequences

- Callers must await registration before using GraphCore
- No protection against misuse—operations on partial state may produce undefined results
- If this becomes a real problem, we can add opt-in synchronization later
