---
title: Graphcore Concurrent Registration
tags:
  - roadmap
type: Enhancement
status: Proposed
priority: P3
effort: S
phase: Post-MVP
category: Infrastructure
---
# GraphCore Concurrent Registration

## Overview

Consider thread-safety for provider registration in concurrent environments.

## Current State

`GraphCoreImpl` allows provider registration via:
- `registerStore(store)`
- `registerEmbedding(embedding)`

These simply assign to instance variables with no locking.

## Potential Issue

In a multi-threaded or async-heavy environment:
1. Thread A calls `registerStore(storeA)`
2. Thread B calls `registerStore(storeB)` simultaneously
3. Race condition on the store assignment

## Impact

Low for current use cases — CLI is single-threaded and providers are typically registered once at startup.

## Future Consideration

If GraphCore is used in a server context with dynamic provider registration:
- Add mutex/lock around registration
- Or make providers immutable after first use
- Or use atomic operations

## References

- `src/core/graphcore.ts` (registerStore, registerEmbedding)
