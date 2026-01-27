---
title: validation-coercion-duplication
tags:
  - medium
  - duplication
  - refactor
---
# Validation Coercion Duplication

**Severity:** Medium  
**Location:** `src/mcp/handlers.ts` lines 38-66

## Problem

`coerceLimit`, `coerceOffset`, `coerceDepth` are nearly identical functions:

```typescript
function coerceLimit(value: unknown): number {
  if (typeof value === 'number') return value;
  return DEFAULT_LIMIT;
}

function coerceOffset(value: unknown): number {
  if (typeof value === 'number') return value;
  return 0;
}

function coerceDepth(value: unknown): 0 | 1 {
  if (value === 1) return 1;
  return 0;
}
```

## Recommended Fix

Create generic coercion utility:

```typescript
function coerceInteger<T extends number>(
  value: unknown, 
  defaultValue: T,
  min?: number,
  max?: number
): T {
  if (typeof value !== 'number') return defaultValue;
  let result = Math.floor(value);
  if (min !== undefined) result = Math.max(result, min);
  if (max !== undefined) result = Math.min(result, max);
  return result as T;
}
```

## Verification

- Single coercion function handles all cases
- Type safety preserved
