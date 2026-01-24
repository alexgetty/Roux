# MCP Server

Model Context Protocol interface for AI co-authoring.

## Overview

The MCP Server is the primary external interface for AI assistants. It exposes Roux's [[GPI]] through the Model Context Protocol, enabling Claude Code and other MCP clients to read, search, traverse, and write to the knowledge graph.

## Tools

### Read Operations

#### `search`
Semantic similarity search. Requires EmbeddingProvider.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | - | Natural language search query |
| `limit` | number | No | 10 | Max results to return |

**Returns:** `Node[]` ordered by similarity (most similar first)

**Example:** `search("machine learning basics")` → relevant notes

---

#### `get_node`
Get a single node with optional context.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | - | Node ID |
| `depth` | number | No | 0 | 0 = node only, 1 = include neighbors |

**Returns:** `NodeWithContext | null`

When `depth: 1`, response includes `neighbors` array and link counts.

---

#### `get_neighbors`
Get nodes linked to/from a node.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | - | Source node ID |
| `direction` | string | No | `"both"` | `"in"` | `"out"` | `"both"` |

**Returns:** `Node[]`

---

#### `find_path`
Find shortest path between two nodes.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `source` | string | Yes | - | Start node ID |
| `target` | string | Yes | - | End node ID |

**Returns:** `string[] | null` (array of node IDs forming path, or null if no path)

---

#### `get_hubs`
Get most central nodes by graph metric.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `metric` | string | No | `"in_degree"` | `"in_degree"` | `"out_degree"` | `"pagerank"` |
| `limit` | number | No | 10 | Max results |

**Returns:** `Array<{ id: string, score: number }>`

See [[Decision - MVP Scope Clarifications]] for rationale on `in_degree` default.

---

#### `search_by_tags`
Filter nodes by tags.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tags` | string[] | Yes | - | Tags to match |
| `mode` | string | No | `"any"` | `"any"` (OR) | `"all"` (AND) |

**Returns:** `Node[]`

---

#### `random_node`
Get a random node for discovery/serendipity.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tags` | string[] | No | - | Limit to nodes with these tags |

**Returns:** `Node`

---

### Write Operations

#### `create_node`
Create a new node.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `title` | string | Yes | - | Node title (see [[Node]] identity rules) |
| `content` | string | Yes | - | Full text content |
| `tags` | string[] | No | `[]` | Classification tags |

**Returns:** `Node` (the created node with final ID)

**Behavior:**
- Fails if node already exists

---

#### `update_node`
Update an existing node.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | - | Node ID to update |
| `title` | string | No | - | New title |
| `content` | string | No | - | New content |
| `tags` | string[] | No | - | New tags (replaces existing) |

**Returns:** `Node` (the updated node)

**Behavior:**
- Fails if node doesn't exist

---

#### `delete_node`
Delete a node.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | - | Node ID to delete |

**Returns:** `boolean` (true if deleted, false if not found)

**Behavior:**
- Returns false if node not found

---

## Dynamic Tool Exposure

Tools are exposed based on configured providers. See [[Decision - Provider Lifecycle]].

| Tool | Required Provider | Exposed When... |
|------|-------------------|-----------------|
| `get_node`, `get_neighbors`, `find_path`, `get_hubs`, `search_by_tags`, `random_node` | StoreProvider | Always (store required) |
| `create_node`, `update_node`, `delete_node` | StoreProvider | Always |
| `search` | StoreProvider + EmbeddingProvider | EmbeddingProvider configured |

If EmbeddingProvider is not configured, `search` tool does not exist in the MCP interface. LLM clients handle this gracefully.

## Error Handling

See [[Decision - Error Contract]] and [[Decision - Error Output]].

| Scenario | Behavior |
|----------|----------|
| Tool not exposed | Provider not configured. Not an error—capability doesn't exist. |
| Node not found | Return `null` (get) or `false` (delete). Not an error. |
| Invalid parameters | Return MCP error with validation message |
| Provider failure | Return MCP error with failure message. System stays up. |

### Warnings

Warnings (broken links, parse issues) are included in response objects:

```json
{
  "result": {
    "node": {...},
    "_warnings": ["Broken link: [[missing]]"]
  }
}
```

File watcher warnings accumulate and surface on the next MCP response, then clear. See [[Decision - Error Output]].

## Future Tools

These require LLMProvider and are deferred to Phase 0.5:

| Tool | Description |
|------|-------------|
| `summarize_node` | Generate summary of node content |
| `suggest_tags` | Suggest tags based on content |
| `extract_entities` | Pull structured entities from text |

## Implementation Notes

- Built with `@modelcontextprotocol/sdk`
- **Transport:** stdio (MVP). Claude Code spawns Roux as subprocess. See [[Decision - MCP Transport]].
- Each tool maps to a [[GraphCore]] operation
- Tool signatures can evolve (add tools freely, deprecation cycle for removal)
- All tools are synchronous from client perspective (async internally)
- **Response formatting:** See [[MCP Tools Schema]] for exact response shapes, including `LinkInfo` resolution via `StoreProvider.resolveTitles()`

## Related

- [[GraphCore]] — Provides the operations
- [[GPI]] — What the MCP server exposes
- [[Config]] — Server configuration
- [[Decision - Provider Lifecycle]] — Tool exposure logic
- [[Decision - Error Contract]] — Error handling
- [[Decision - Error Output]] — Where warnings/errors go
- [[Decision - MCP Transport]] — stdio vs SSE transport
