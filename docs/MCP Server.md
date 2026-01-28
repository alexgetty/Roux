---
title: Mcp Server
---
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
| `include_content` | boolean | No | false | Include node content in results. Default false returns metadata only (id, title, tags, properties, links). |

**Returns:** `Node[]` ordered by similarity (most similar first)

---

#### `get_node`
Get a single node with optional context.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | - | Node ID (normalized to lowercase) |
| `depth` | number | No | 0 | 0 = node only, 1 = include neighbors |

**Returns:** `NodeWithContext | null`

When `depth: 1`, response includes `neighbors` array and link counts.

---

#### `get_neighbors`
Get nodes linked to/from a node.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | - | Source node ID (normalized to lowercase) |
| `direction` | string | No | `"both"` | `"in"` | `"out"` | `"both"` |
| `limit` | number | No | 20 | Max neighbors to return |
| `include_content` | boolean | No | false | Include node content in results. Default false returns metadata only. |

**Returns:** `Node[]`

---

#### `find_path`
Find shortest path between two nodes.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `source` | string | Yes | - | Start node ID (normalized to lowercase) |
| `target` | string | Yes | - | End node ID (normalized to lowercase) |

**Returns:** `string[] | null` (array of node IDs forming path, or null if no path)

---

#### `get_hubs`
Get most central nodes by graph metric.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `metric` | string | No | `"in_degree"` | `"in_degree"` | `"out_degree"` (PageRank planned, not yet implemented) |
| `limit` | number | No | 10 | Max results |

**Returns:** `Array<{ id: string, score: number }>`

See [[decisions/MVP Scope Clarifications]] for rationale on `in_degree` default.

---

#### `search_by_tags`
Filter nodes by tags.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tags` | string[] | Yes | - | Tags to match |
| `mode` | string | No | `"any"` | `"any"` (OR) | `"all"` (AND) |
| `limit` | number | No | 20 | Max results |

**Returns:** `Node[]`

---

#### `random_node`
Get a random node for discovery/serendipity.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tags` | string[] | No | - | Limit to nodes with these tags |

**Returns:** `Node`

---

#### `list_nodes`
List nodes with optional filters and pagination.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tag` | string | No | - | Filter by tag from "tags" frontmatter array (case-insensitive) |
| `path` | string | No | - | Filter by path prefix (startsWith, case-insensitive) |
| `limit` | number | No | 100 | Max results (max 1000) |
| `offset` | number | No | 0 | Skip this many results (pagination) |

**Returns:** `{ nodes: NodeSummary[], total: number }`

---

#### `resolve_nodes`
Batch resolve names to existing node IDs.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `names` | string[] | Yes | - | Names to resolve |
| `strategy` | string | No | `"fuzzy"` | `"exact"`, `"fuzzy"`, or `"semantic"` |
| `threshold` | number | No | 0.7 | Min similarity (0-1). Ignored for exact. |
| `tag` | string | No | - | Filter candidates by tag |
| `path` | string | No | - | Filter candidates by path prefix |

**Returns:** `ResolveResult[]`

---

#### `nodes_exist`
Batch check if node IDs exist.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `ids` | string[] | Yes | - | Node IDs to check (normalized to lowercase) |

**Returns:** `Map<string, boolean>`

---

### Write Operations

#### `create_node`
Create a new node.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | - | Full path for new node (must end in .md, lowercased) |
| `content` | string | Yes | - | Full text content (markdown) |
| `title` | string | No | derived from id | Optional display title |
| `tags` | string[] | No | `[]` | Classification tags |

**Returns:** `Node` (the created node with final ID)

**Behavior:**
- Fails if node already exists

---

#### `update_node`
Update an existing node.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | - | Node ID to update (normalized to lowercase) |
| `title` | string | No | - | New title (renames file for DocStore) |
| `content` | string | No | - | New content (replaces entirely) |
| `tags` | string[] | No | - | New tags (replaces existing) |

**Returns:** `Node` (the updated node)

**Behavior:**
- Fails if node doesn't exist
- Title changes rejected if incoming links exist

---

#### `delete_node`
Delete a node.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | - | Node ID to delete (normalized to lowercase) |

**Returns:** `boolean` (true if deleted, false if not found)

**Behavior:**
- Returns false if node not found

---

## Dynamic Tool Exposure

Tools are exposed based on configured providers. See [[decisions/Provider Lifecycle]].

| Tool | Required Provider | Exposed When... |
|------|-------------------|-----------------|
| `get_node`, `get_neighbors`, `find_path`, `get_hubs`, `search_by_tags`, `random_node`, `list_nodes`, `resolve_nodes`, `nodes_exist` | Store | Always (store required) |
| `create_node`, `update_node`, `delete_node` | Store | Always |
| `search` | Store + Embedding | Embedding configured |

If Embedding is not configured, `search` tool does not exist in the MCP interface. LLM clients handle this gracefully.

## Error Handling

See [[decisions/Error Contract]] and [[decisions/Error Output]].

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
    "node": {},
    "_warnings": ["Broken link: [[missing]]"]
  }
}
```

File watcher warnings accumulate and surface on the next MCP response, then clear. See [[decisions/Error Output]].

## Future Tools

These require LLMProvider and are deferred post-MVP:

| Tool | Description |
|------|-------------|
| `summarize_node` | Generate summary of node content |
| `suggest_tags` | Suggest tags based on content |
| `extract_entities` | Pull structured entities from text |

## Implementation Notes

- Built with `@modelcontextprotocol/sdk`
- **Transport:** stdio (MVP). Claude Code spawns Roux as subprocess. See [[decisions/MCP Transport]].
- Each tool maps to a [[GraphCore]] operation
- Tool signatures can evolve (add tools freely, deprecation cycle for removal)
- All tools are synchronous from client perspective (async internally)
- **Response formatting:** See [[MCP Tools Schema]] for exact response shapes, including `LinkInfo` resolution via `Store.resolveTitles()`

## Related

- [[GraphCore]] — Provides the operations
- [[GPI]] — What the MCP server exposes
- [[Config]] — Server configuration
- [[decisions/Provider Lifecycle]] — Tool exposure logic
- [[decisions/Error Contract]] — Error handling
- [[decisions/Error Output]] — Where warnings/errors go
- [[decisions/MCP Transport]] — stdio vs SSE transport
