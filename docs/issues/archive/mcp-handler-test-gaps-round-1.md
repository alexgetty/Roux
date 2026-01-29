---
type: Issue
severity: Medium
component: MCP
phase: current
title: MCP Handler Test Gaps - Round 1
tags:
  - issue
  - testing
  - mcp
---

# MCP Handler Test Gaps - Round 1

## Problem

Red-team audit of `tests/unit/mcp/handlers.test.ts` identified the following tech debt:

### 1. Repeated Dynamic Imports
Lines 1125, 1146, 1160, 1181, 1190, 1200, 1207, 1220, 1227, 1234, 1247, 1262, 1271, 1280, 1289, 1301, 1313, 1334, 1350, 1359, 1368, 1378 all use:
```typescript
const { handleListNodes } = await import('../../../src/mcp/handlers.js');
```

Instead of importing once at top of file like other handlers. Creates module caching fragility.

### 2. Inconsistent Error Message Assertions
Some INVALID_PARAMS tests assert message content:
```typescript
expect.stringContaining('limit')  // line 211
expect.stringContaining('non-empty')  // line 147
```

Others only assert the code:
```typescript
{ code: 'INVALID_PARAMS' }  // lines 278, 841, etc.
```

If error messages change, coverage is inconsistent.

## Impact

- Tech debt accumulation
- Fragile test infrastructure
- Inconsistent assertion patterns

## Suggested Fix

1. Move `handleListNodes`, `handleResolveNodes`, `handleNodesExist` imports to top of file with other handler imports
2. Add message content assertions to remaining INVALID_PARAMS tests for consistency (or document why some don't need them)

## References

- Red-team audit (2026-01-25)
