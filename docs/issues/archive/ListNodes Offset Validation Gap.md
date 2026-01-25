---
type: Issue
severity: Low
component: MCP
---

# ListNodes Offset Validation Gap

## Problem

The `list_nodes` MCP handler accepts an `offset` parameter but may not validate negative values.

**Location:** `src/mcp/handlers.ts:378`

```typescript
return ctx.core.listNodes(filter, { limit, offset });
```

## Current Behavior

The MCP schema in `src/mcp/server.ts` defines:

```typescript
offset: {
  type: 'integer',
  minimum: 0,
  // ...
}
```

JSON Schema validation should reject negative offsets, but:
1. Is MCP SDK actually enforcing schema validation?
2. What happens if validation is bypassed?

## Test Gap

No test verifying:
- `list_nodes({ offset: -1 })` is rejected
- `list_nodes({ offset: -100 })` is rejected

## Suggested Test

```typescript
it('rejects negative offset', async () => {
  const result = await handleListNodes(
    { offset: -1 },
    ctx
  );
  expect(result).toMatchObject({
    error: expect.objectContaining({ code: 'INVALID_PARAMS' })
  });
});
```

## References

- `src/mcp/handlers.ts:378`
- `src/mcp/server.ts` (TOOL_SCHEMAS.list_nodes)
