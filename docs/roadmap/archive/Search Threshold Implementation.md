---
id: eo2MkSCRSOYp
type: Roadmap
priority: Medium
component: GraphCore
---
# Search Threshold Implementation

## Overview

Make the semantic search similarity threshold configurable.

## Current State

`src/core/graphcore.ts:207`:

```typescript
const threshold = options?.threshold ?? 0.7;
```

The `resolveNodes` method accepts a threshold parameter, but the main `search` method doesn't expose this.

## Proposal

Add threshold parameter to search options:

```typescript
interface SearchOptions {
  limit?: number;
  threshold?: number;  // Minimum similarity score (0-1)
}

async search(query: string, options?: SearchOptions): Promise<Node[]> {
  const threshold = options?.threshold ?? 0.5;  // Lower default for search
  // Filter results below threshold
}
```

## Use Cases

1. **Strict matching** — High threshold (0.8+) for precise results
2. **Exploratory search** — Low threshold (0.3-0.5) for discovering tangentially related content
3. **Domain-specific tuning** — Different domains may need different thresholds

## MCP Integration

Update `search` tool schema:

```typescript
threshold: {
  type: 'number',
  minimum: 0,
  maximum: 1,
  default: 0.5,
  description: 'Minimum similarity score (0-1). Higher = stricter matching.'
}
```

## References

- `src/core/graphcore.ts:207` (resolveNodes threshold)
- `src/mcp/server.ts` (search tool schema)
