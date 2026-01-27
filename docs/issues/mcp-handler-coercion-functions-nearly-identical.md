---
title: MCP Handler Coercion Functions Nearly Identical
tags:
  - dry
  - medium-priority
  - refactor
---
## Priority: MEDIUM

## Problem

`coerceLimit` and `coerceOffset` are 90% identical, differing only in the minimum value check (`<1` vs `<0`) and error message.

## Location

`src/mcp/handlers.ts:38-66`

## Evidence

```typescript
function coerceLimit(value: unknown, defaultValue: number): number {
  if (value === undefined || value === null) { return defaultValue; }
  const num = Number(value);
  if (Number.isNaN(num)) { return defaultValue; }
  const floored = Math.floor(num);
  if (floored < 1) { throw new McpError('INVALID_PARAMS', 'limit must be at least 1'); }
  return floored;
}

function coerceOffset(value: unknown, defaultValue: number): number {
  if (value === undefined || value === null) { return defaultValue; }
  const num = Number(value);
  if (Number.isNaN(num)) { return defaultValue; }
  const floored = Math.floor(num);
  if (floored < 0) { throw new McpError('INVALID_PARAMS', 'offset must be at least 0'); }
  return floored;
}
```

## Fix

Create generic helper:

```typescript
function coercePositiveInt(
  value: unknown,
  defaultValue: number,
  minValue: number,
  fieldName: string
): number {
  if (value === undefined || value === null) return defaultValue;
  const num = Number(value);
  if (Number.isNaN(num)) return defaultValue;
  const floored = Math.floor(num);
  if (floored < minValue) {
    throw new McpError('INVALID_PARAMS', `${fieldName} must be at least ${minValue}`);
  }
  return floored;
}
```

## Verification

Existing handler tests pass.
