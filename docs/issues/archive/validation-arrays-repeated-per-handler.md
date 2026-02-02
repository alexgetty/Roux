---
id: LOal5ID6ufdr
title: Validation Arrays Repeated Per Handler
tags:
  - dry
  - medium-priority
  - refactor
---
## Priority: MEDIUM

## Problem

Each MCP handler declares its own `VALID_*` array for enum validation. This pattern is repeated 4 times, and the values should be derived from type definitions.

## Location

`src/mcp/handlers.ts:159, 208, 229, 389`

## Evidence

```typescript
const VALID_DIRECTIONS = ['in', 'out', 'both'] as const;          // line 159
const VALID_METRICS = ['in_degree', 'out_degree'] as const;       // line 208
const VALID_TAG_MODES = ['any', 'all'] as const;                  // line 229
const VALID_STRATEGIES = ['exact', 'fuzzy', 'semantic'] as const; // line 389
```

These duplicate the type definitions in `src/types/provider.ts` and `src/types/edge.ts`.

## Fix

1. Move validation arrays to type definition files
2. Export alongside the types they validate
3. Or derive arrays from union types using a helper

Example:
```typescript
// types/edge.ts
export type Direction = 'in' | 'out' | 'both';
export const VALID_DIRECTIONS: readonly Direction[] = ['in', 'out', 'both'];
```

## Verification

Handler tests pass; type safety maintained.
