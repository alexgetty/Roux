---
title: List Tags Tool
tags:
  - roadmap
type: Feature
status: Proposed
priority: P3
effort: S
phase: Post-MVP
category: Search & Query
---
# Feature - List Tags Tool

Discover available tags in the graph.

## Summary

Add `list_tags` MCP tool to enumerate all tags used across nodes.

## Problem

Currently, LLMs must guess tag names or do exploratory `search_by_tags` calls. No way to discover what tags exist.

## Proposed

```json
// Request
{ "prefix": "proj" }  // optional filter

// Response
[
  { "tag": "project-x", "count": 15 },
  { "tag": "project-y", "count": 8 }
]
```

## Implementation

- DocStore: Query SQLite for distinct tags with counts
- Return sorted by count (most used first)
- Optional prefix filter for autocomplete-style usage

## Complexity

Low — simple aggregation query.

## References

- [[MCP Tools Schema]] — Tool definitions
- [[DocStore]] — Tag storage in SQLite
