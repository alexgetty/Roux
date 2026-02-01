---
title: Search Threshold
tags:
  - roadmap
type: Feature
status: Proposed
priority: P3
effort: S
phase: Post-MVP
category: Search & Query
---
# Feature - Search Threshold

Add minimum similarity threshold to semantic search.

## Summary

Allow filtering search results by minimum similarity score (0-1).

## Current State

`search` tool returns top N results by similarity, regardless of how weak the match is.

## Proposed

Add `threshold` parameter:
```json
{
  "query": "machine learning",
  "limit": 10,
  "threshold": 0.7
}
```

Only return results with `score >= threshold`.

## Complexity

Low — parameter already exists in `SearchOptions` interface, just not exposed via MCP.

## References

- [[MCP Tools Schema#search]] — Current spec
- [[GraphCore]] — `SearchOptions.threshold` already defined
