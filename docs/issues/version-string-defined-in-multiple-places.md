---
title: Version String Defined in Multiple Places
tags:
  - dry
  - medium-priority
  - cleanup
---
## Priority: MEDIUM

## Problem

Version string '0.1.0' appears in 3 locations and must be updated in all places for releases.

## Locations

- `src/index.ts:3` - `export const VERSION = '0.1.0'`
- `src/cli/index.ts:16` - `.version('0.1.0')`
- `src/mcp/server.ts:468` - `{ name: 'roux', version: '0.1.0' }`

## Fix

Import VERSION from `src/index.ts` in all locations:

```typescript
import { VERSION } from '../index.js';
// then use VERSION instead of literal
```

## Verification

`roux --version` and MCP server info both report correct version.
