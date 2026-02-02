---
id: ZSGCJWmNx-Q2
title: Search Default Limit
tags:
  - roadmap
type: Feature
status: Proposed
priority: P3
effort: S
phase: Post-MVP
category: Search & Query
---
# Feature - Search Default Limit

Tune default search limit for larger graphs.

## Summary

MVP default limit of 10 results works for <200 nodes. May be too low for larger graphs.

## Current State

`handleSearch` defaults to `limit: 10` if not specified.

## Proposed

- Increase default to 20 or make configurable
- Consider dynamic default based on graph size
- Document recommended limits for different scales

## Complexity

Low — single constant change, but needs UX consideration.

## References

- Phase 10 red-team audit round 2 (2026-01-24)
