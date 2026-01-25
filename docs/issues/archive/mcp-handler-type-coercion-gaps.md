---
title: MCP Handler Type Coercion Gaps
tags:
  - issue
  - mcp
  - validation
---
# MCP Handler Type Coercion Gaps

Multiple handlers assume parameter types without validation.

## 1. Depth parsing assumes number

**Location:** `src/mcp/handlers.ts:78`

```typescript
const depth = (args.depth as number) ?? 0;
```

If MCP client sends `depth: "1"` (string), comparison `depth === 0` fails unexpectedly.

**Fix:** Add coercion similar to `coerceLimit`.

## 2. Limit coercion allows floats

**Location:** `src/mcp/handlers.ts:28-34`

`Number('3.5')` → `3.5` passes through. SQLite truncates during `LIMIT 3.5`.

**Fix:** Use `Math.floor` or `parseInt`.

## 3. Numeric ID edge case

**Location:** `src/mcp/handlers.ts` (multiple handlers)

Handlers cast `args.id as string` without validation. `{id: 123}` proceeds with invalid type.

**Fix:** Add runtime validation that id is string.

## References

- Red team round 2 #3
- Red team round 4 #1
- Red team round 6 #1
- Red team round 10
