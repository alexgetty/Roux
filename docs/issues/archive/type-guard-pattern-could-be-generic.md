---
id: TRpRonAZZ8nK
title: Type Guard Pattern Could Be Generic
tags:
  - dry
  - medium-priority
  - refactor
---
## Priority: MEDIUM

## Problem

`isNode` and `isVectorIndex` follow identical structural patterns that could potentially use a generic helper.

## Locations

- `src/types/node.ts` - `isNode()`
- `src/types/provider.ts` - `isVectorIndex()` (renamed from `isVectorProvider` in naming refactor)

## Evidence

Both follow pattern:
1. Check if value is non-null object
2. Cast to Record
3. Check required properties exist with correct types

## Assessment

This is borderline—the current code is readable and type-safe. A generic helper might reduce clarity. Consider only if more type guards are added.

## Fix (Optional)

Could create a schema-based validator, but may be over-engineering for 2 guards.
