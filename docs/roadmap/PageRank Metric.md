---
id: 8VM6sGTWaCmR
title: Pagerank Metric
tags:
  - roadmap
type: Feature
status: Proposed
priority: P2
effort: M
phase: Post-MVP
category: Search & Query
---
# Feature - PageRank Metric

Add PageRank centrality metric to `get_hubs`.

## Summary

PageRank identifies important nodes based on link quality, not just quantity.

## Current State

MVP uses `in_degree` only (count of incoming links). Fast O(1) lookup.

## Problem

In-degree treats all links equally. A node linked by 10 low-quality pages ranks higher than one linked by 1 authoritative hub.

## Proposed

Add `pagerank` option to `get_hubs`:
```json
{ "metric": "pagerank", "limit": 10 }
```

## Implementation

- Graphology has PageRank algorithm built-in
- Compute on graph build, cache in SQLite `centrality` table
- Recompute when graph structure changes

## Complexity

Medium — algorithm exists, need caching strategy.

## Performance

O(n) computation vs O(1) for in_degree. Cache mitigates query-time cost.

## References

- [[MCP Tools Schema#get_hubs]] — Current spec
- [[decisions/MVP Scope Clarifications]] — Deferred decision
- [[Graph Projection]] — Graphology integration
