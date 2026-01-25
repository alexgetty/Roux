# MCP Response Size Killing Token Context

## Problem

MCP tool responses return full node content, which can be massive and quickly fills up the AI's context window.

## Examples

```
get_neighbors(id: "docs/emergence.md", direction: "in", limit: 30)
⚠ Large MCP response (~16.4k tokens)
+2473 lines

get_neighbors(id: "docs/assembly theory.md", direction: "both", limit: 20)
⚠ Large MCP response (~10.1k tokens)
+1580 lines
```

Even with reasonable `limit` values (15-30), a single call can consume 10-16k tokens.

## Potential Solutions

1. **Return IDs/metadata only by default** - Add `includeContent: boolean` param, default false
2. **Truncate content** - Add `maxContentLength` param to trim large nodes
3. **Pagination** - Return smaller pages with continuation tokens
4. **Summary mode** - Return node summaries instead of full content
5. **Streaming** - If MCP supports it, stream results incrementally

## Impact

- Makes graph exploration impractical for AI assistants
- Single exploratory query can use 10-20% of context
- Forces users to use tiny limits, missing connections
