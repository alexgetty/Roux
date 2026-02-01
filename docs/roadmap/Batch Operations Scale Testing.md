---
title: Batch Operations Scale Testing
tags:
  - roadmap
type: Feature
status: Proposed
priority: P3
effort: S
phase: Post-MVP
category: Testing
parent: '[[Testing Framework]]'
---
# Batch Operations Scale Testing

## Context

Red-team audit of `listNodes`, `resolveNodes`, `nodesExist` batch operations. MVP targets <500 nodes per success criteria.

## Proposal

Add performance tests for batch operations at scale:
- `resolveNodes` with 1000+ candidates
- `listNodes` pagination at scale
- `nodesExist` with large ID arrays

## Why Deferred

MVP targets <500 nodes. Current implementation uses SQLite with proper indexing which should scale well, but explicit benchmarks are post-MVP.

## References

- Red-team audit (2026-01-24)
- MVP.md success criteria: "Works on directory with 500+ nodes"
