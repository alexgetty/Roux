---
title: LinkInfo Type Exported from Two Places
tags:
  - dry
  - medium-priority
  - cleanup
---
## Priority: MEDIUM

## Problem

`LinkInfo` is defined in `provider.ts` and re-exported from `mcp/types.ts`, creating confusing indirection.

## Locations

- `src/types/provider.ts:66-70` - definition
- `src/mcp/types.ts:1-4` - re-export

## Evidence

```typescript
// provider.ts:66-70
export interface LinkInfo {
  id: string;
  title: string;
}

// mcp/types.ts:1-4
import type { LinkInfo } from '../types/provider.js';
export type { LinkInfo };
```

## Fix

1. Import directly from `types/provider.js` in MCP consumers
2. Remove the re-export from `mcp/types.ts`

## Verification

All imports resolve correctly; tests pass.
