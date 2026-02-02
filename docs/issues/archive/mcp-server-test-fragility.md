---
id: Fv9B_YFl8G20
title: MCP Server Test Fragility
tags:
  - issue
  - testing
  - mcp
type: Issue
severity: Medium
component: MCP
phase: current
---
# MCP Server Test Fragility

## Problem

Red-team audit of `tests/unit/mcp/server.test.ts` identified the following tech debt:

### 1. Handler Capture Tests Rely on SDK Mock Details
Lines 61-71 mock the MCP SDK Server and capture handlers by schema reference:
```typescript
const capturedHandlers = new Map<unknown, (...args: unknown[]) => unknown>();
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    setRequestHandler: vi.fn((schema: unknown, handler) => {
      capturedHandlers.set(schema, handler);
    }),
    // ...
  })),
}));
```

If the SDK changes `setRequestHandler` signature or behavior, tests break silently.

### 2. No Circular Reference Guard Test
`formatToolResponse` uses `JSON.stringify(result, null, 2)` without try/catch. If a handler ever returned a circular object structure, it would throw an unhandled error that wouldn't be caught by `formatErrorResponse`.

Current handlers never return circular data, so this is theoretical — but there's no test asserting the behavior.

## Impact

- Fragile coupling to SDK mock implementation
- Unguarded edge case in error handling

## Suggested Fix

1. Document the SDK mock approach with a comment explaining the coupling
2. Either add circular reference protection to `formatToolResponse` or document why it's not needed (current handler outputs are always serializable)

## References

- Red-team audit (2026-01-25)
