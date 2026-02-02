---
id: '-3mLCgNkkXlb'
title: MCP resolve_nodes Exact Strategy Threshold Confusion
tags:
  - Issue
  - mcp
  - medium
type: Issue
severity: Medium
component: MCP
phase: MVP
---
# resolve_nodes Exact Strategy Threshold Confusion

## Problem

Schema documents that threshold is "Ignored for exact strategy" but doesn't explain why or what exact actually returns.

Exact strategy (`cache.ts:314-320`) returns:
- `score: 1` for matches (always perfect match)
- `score: 0` for non-matches

An LLM might pass `threshold: 0.9` with `strategy: "exact"` expecting partial matches to be filtered. They won't be - exact is all-or-nothing.

## Impact

Minor confusion. Technically documented correctly but behavior is non-obvious.

## Suggested Fix

Clarify schema:
```
'exact: case-insensitive title equality, always returns score 1.0 or 0 (threshold ignored)'
```

## References

- Red-team audit (2026-01-25)
