---
title: graphcore-approaching-threshold
tags:
  - high
  - modularity
  - monitor
---
# GraphCore Approaching Threshold

**Severity:** High  
**Location:** `src/core/graphcore.ts`  
**Lines:** 305

## Problem

Just over the 300-line warning threshold. Acceptable for now but should be monitored.

## Known Duplication

`cosineSimilarity` (lines 258-269) is duplicated elsewhere in codebase. See [[duplicate-cosine-similarity-implementation]].

## Recommended Action

1. Extract `cosineSimilarity` to shared utility
2. Monitor for growth — if it crosses 400 lines, split
3. Review after DocStore refactor as patterns may emerge

## Verification

- Keep under 350 lines
- No duplicated utilities
