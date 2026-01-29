---
type: Enhancement
status: Proposed
priority: P3
effort: S
phase: Post-MVP
category: Search & Query
---

# Resolve Threshold Validation

## Context

Red-team audit of `handleResolveNodes`. Threshold parameter accepts negative values (e.g., `-0.5`) without validation.

## Current Behavior

Negative threshold means nothing matches (similarity scores are 0-1). Not a bug — just permissive.

## Proposal

Add validation to reject threshold outside 0-1 range with INVALID_PARAMS error.

## Why Deferred

Current behavior is safe (fails closed). Stricter validation is nice-to-have, not correctness.

## References

- Red-team audit (2026-01-24)
