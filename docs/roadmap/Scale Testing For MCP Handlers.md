---
id: 91Zn62itZhb5
title: Scale Testing For Mcp Handlers
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
# Scale Testing for MCP Handlers

## Context

Red-team audit identified missing scale/stress tests for MCP handlers:

1. **Large tag arrays**: No test for `handleSearchByTags` with 1,000+ tags
2. **Concurrent tool calls**: No test for simultaneous `executeToolCall` invocations

## Proposal

Add scale tests when moving beyond MVP:
- Test `searchByTags` with arrays of 100, 1000, 10000 tags
- Test concurrent MCP requests (10, 100 simultaneous calls)
- Establish performance baselines and regression guards

## Why Deferred

- MVP targets <200 nodes
- SQLite handles atomicity for concurrent writes
- Current scale doesn't warrant stress testing infrastructure

## References

- Red-team audit (2026-01-25)
