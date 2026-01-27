---
title: handler-dispatch-boilerplate
tags:
  - enhancement
  - pattern
  - mcp
---
# Handler Dispatch Boilerplate

**Type:** Roadmap / Enhancement  
**Location:** `src/mcp/server.ts` lines 501-536

## Current State

The `dispatchTool` method uses a switch statement to route tool names to handlers:

```typescript
switch (name) {
  case 'search':
    return handleSearch(core, args);
  case 'get_node':
    return handleGetNode(core, args);
  // ... 15 more cases
}
```

## Potential Improvement

Handler registry pattern:

```typescript
const handlers: Record<string, Handler> = {
  search: handleSearch,
  get_node: handleGetNode,
  // ...
};

function dispatchTool(name: string, args: unknown) {
  const handler = handlers[name];
  if (!handler) throw new Error(`Unknown tool: ${name}`);
  return handler(core, args);
}
```

## Trade-offs

**Pros:**
- Adding tools doesn't touch dispatch logic
- Handlers are more self-contained
- Easier to test handler registration

**Cons:**
- Current approach works fine
- Switch gives explicit control flow
- May be premature abstraction

## Recommendation

Consider when splitting handlers into modules — registry pattern fits better with modular handlers.
