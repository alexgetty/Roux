---
title: Mcp Tools Schema
---
# MCP Tools Schema

Exact specifications for all MCP tools.

## Design Principles

1. **Context window awareness**: Default limits prevent overwhelming LLM context
2. **Consistent response shapes**: All tools return predictable structures
3. **Graceful degradation**: Missing data returns null/empty, not errors
4. **Capability-based exposure**: Tools only exist if providers support them

---

## Response Types

### LinkInfo

Link with resolved human-readable title.

```typescript
interface LinkInfo {
  id: string;     // Node ID (opaque to MCP layer)
  title: string;  // Human-readable title (for LLM context)
}
```

### NodeResponse

Subset of Node fields optimized for LLM consumption.

```typescript
interface NodeResponse {
  id: string;
  title: string;
  content: string;           // Full content (may be truncated per tool)
  tags: string[];
  links: LinkInfo[];         // Outgoing links with resolved titles
}
```

**Why `links` with titles instead of just IDs?**

Link titles provide semantic context for LLM reasoning. The Store resolves IDs to titles:
- **DocStore**: Derives title from file path (zero IO)
- **Neo4jStore**: Batch queries for title property (one round-trip)

This abstraction keeps MCP store-agnostic while enabling rich context. See `Store.resolveTitles()`.

### NodeWithContextResponse

Extended response for `get_node` with depth > 0.

```typescript
interface NodeWithContextResponse extends NodeResponse {
  incomingNeighbors: NodeResponse[];  // Nodes linking TO this node (truncated content)
  outgoingNeighbors: NodeResponse[];  // Nodes this links TO (truncated content)
  incomingCount: number;              // Total nodes linking TO this node
  outgoingCount: number;              // Total nodes this links TO
}
```

**Note:** `incomingCount` and `outgoingCount` may exceed array lengths due to the 20-neighbor limit per direction.

### SearchResultResponse

Search results include similarity score.

```typescript
interface SearchResultResponse extends NodeResponse {
  score: number;  // 0-1, higher = more similar
}
```

### HubResponse

Hub results pair ID with metric value.

```typescript
interface HubResponse {
  id: string;
  title: string;
  score: number;  // Metric value (in_degree count, out_degree count)
}
```

### PathResponse

Path results are ordered node IDs.

```typescript
interface PathResponse {
  path: string[];  // [source, ...intermediates, target]
  length: number;  // path.length - 1 (edge count)
}
```

---

## Content Truncation

To prevent context overflow:

| Context | Max Content Length | Behavior |
|---------|-------------------|----------|
| Primary node (`get_node`, single result) | 10,000 chars | Truncate with `...` |
| List results (search, neighbors) | 500 chars | Truncate with `...` |
| Neighbor nodes in context | 200 chars | Truncate with `...` |

Truncation appends `... [truncated]` to indicate partial content.

---

## Tool Specifications

### search

Semantic similarity search.

**Required provider:** Embedding (tool hidden if not configured)

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Natural language search query"
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 50,
      "default": 10,
      "description": "Maximum results to return"
    },
    "include_content": {
      "type": "boolean",
      "default": false,
      "description": "Include node content in results. Default false returns metadata only (id, title, tags, properties, links). Set true to include truncated content."
    }
  },
  "required": ["query"]
}
```

**Response:** `SearchResultResponse[]`

**Example:**
```json
{
  "query": "machine learning fundamentals",
  "limit": 5
}
```

**Returns:**
```json
[
  {
    "id": "notes/ml-basics.md",
    "title": "Machine Learning Basics",
    "content": "Introduction to supervised and unsupervised... [truncated]",
    "tags": ["ml", "tutorial"],
    "links": [
      { "id": "notes/neural-networks.md", "title": "Neural Networks" },
      { "id": "notes/supervised-learning.md", "title": "Supervised Learning" }
    ],
    "score": 0.89
  }
]
```

---

### get_node

Retrieve single node with optional neighbor context.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Node ID (file path for DocStore). ID is normalized to lowercase."
    },
    "depth": {
      "type": "integer",
      "minimum": 0,
      "maximum": 1,
      "default": 0,
      "description": "0 = node only, 1 = include neighbors"
    }
  },
  "required": ["id"]
}
```

**Response:** `NodeResponse | NodeWithContextResponse | null`

**Depth behavior:**
- `depth: 0` → Returns `NodeResponse`
- `depth: 1` → Returns `NodeWithContextResponse` with up to 20 neighbors

**Example (depth 0):**
```json
{ "id": "notes/graphcore.md" }
```

**Returns:**
```json
{
  "id": "notes/graphcore.md",
  "title": "GraphCore",
  "content": "The orchestration hub of Roux...",
  "tags": ["architecture", "core"],
  "links": [
    { "id": "notes/storeprovider.md", "title": "StoreProvider" },
    { "id": "notes/embeddingprovider.md", "title": "EmbeddingProvider" },
    { "id": "notes/node.md", "title": "Node" }
  ]
}
```

**Example (depth 1):**
```json
{ "id": "notes/graphcore.md", "depth": 1 }
```

**Returns:**
```json
{
  "id": "notes/graphcore.md",
  "title": "GraphCore",
  "content": "The orchestration hub of Roux...",
  "tags": ["architecture", "core"],
  "links": [
    { "id": "notes/storeprovider.md", "title": "StoreProvider" },
    { "id": "notes/embeddingprovider.md", "title": "EmbeddingProvider" }
  ],
  "incomingCount": 15,
  "outgoingCount": 8,
  "outgoingNeighbors": [
    {
      "id": "notes/storeprovider.md",
      "title": "StoreProvider",
      "content": "Data persistence and graph op... [truncated]",
      "tags": ["provider"],
      "links": [
        { "id": "notes/node.md", "title": "Node" }
      ]
    }
  ],
  "incomingNeighbors": [
    {
      "id": "notes/architecture.md",
      "title": "Architecture Overview",
      "content": "Roux is built around the Grap... [truncated]",
      "tags": ["overview"],
      "links": [
        { "id": "notes/graphcore.md", "title": "GraphCore" }
      ]
    }
  ]
}
```

---

### get_neighbors

Get nodes linked to/from a node.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Source node ID. ID is normalized to lowercase."
    },
    "direction": {
      "type": "string",
      "enum": ["in", "out", "both"],
      "default": "both",
      "description": "in = nodes linking here, out = nodes linked to, both = all"
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 50,
      "default": 20,
      "description": "Maximum neighbors to return"
    },
    "include_content": {
      "type": "boolean",
      "default": false,
      "description": "Include node content in results. Default false returns metadata only (id, title, tags, properties, links). Set true to include truncated content."
    }
  },
  "required": ["id"]
}
```

**Response:** `NodeResponse[]`

**Example:**
```json
{ "id": "notes/graphcore.md", "direction": "in", "limit": 10 }
```

---

### find_path

Find shortest path between two nodes.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "source": {
      "type": "string",
      "description": "Start node ID. ID is normalized to lowercase."
    },
    "target": {
      "type": "string",
      "description": "End node ID. ID is normalized to lowercase."
    }
  },
  "required": ["source", "target"]
}
```

**Response:** `PathResponse | null`

**Example:**
```json
{ "source": "notes/intro.md", "target": "notes/advanced.md" }
```

**Returns:**
```json
{
  "path": ["notes/intro.md", "notes/basics.md", "notes/advanced.md"],
  "length": 2
}
```

Returns `null` if no path exists.

---

### get_hubs

Get most central nodes by graph metric.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "metric": {
      "type": "string",
      "enum": ["in_degree", "out_degree"],
      "default": "in_degree",
      "description": "Centrality metric"
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 50,
      "default": 10,
      "description": "Maximum results"
    }
  }
}
```

**Response:** `HubResponse[]`

**Example:**
```json
{ "metric": "in_degree", "limit": 5 }
```

**Returns:**
```json
[
  { "id": "notes/index.md", "title": "Index", "score": 45 },
  { "id": "notes/glossary.md", "title": "Glossary", "score": 32 }
]
```

**Future:** `pagerank` metric planned but not yet implemented.

---

### search_by_tags

Filter nodes by tags.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "description": "Tags to match"
    },
    "mode": {
      "type": "string",
      "enum": ["any", "all"],
      "default": "any",
      "description": "any = OR matching, all = AND matching"
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100,
      "default": 20,
      "description": "Maximum results"
    }
  },
  "required": ["tags"]
}
```

**Response:** `NodeResponse[]`

**Example:**
```json
{ "tags": ["tutorial", "ml"], "mode": "all" }
```

---

### random_node

Get random node for discovery.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Optional: limit to nodes with these tags (any match)"
    }
  }
}
```

**Response:** `NodeResponse | null`

Returns `null` if graph is empty (or no nodes match tag filter).

**Example:**
```json
{ "tags": ["idea"] }
```

---

### create_node

Create a new node (writes file for DocStore).

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Full path for new node (must end in .md). Will be lowercased (spaces and special characters preserved). Example: \"notes/My Note.md\" creates \"notes/my note.md\""
    },
    "content": {
      "type": "string",
      "description": "Full text content (markdown)"
    },
    "title": {
      "type": "string",
      "description": "Optional display title. Defaults to filename without .md extension."
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "default": [],
      "description": "Classification tags"
    }
  },
  "required": ["id", "content"]
}
```

**Response:** `NodeResponse` (the created node)

**Example:**
```json
{
  "id": "meetings/meeting-notes-2024-01-15.md",
  "content": "# Meeting Notes\n\nDiscussed project timeline...",
  "tags": ["meeting", "project-x"]
}
```

**Behavior:**
- ID is lowercased automatically
- Parent directories created if needed
- Fails if node already exists

**Error:** Returns error if node already exists.

---

### update_node

Update an existing node.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Node ID to update. ID is normalized to lowercase."
    },
    "title": {
      "type": "string",
      "description": "New title (renames file for DocStore)"
    },
    "content": {
      "type": "string",
      "description": "New content (replaces entirely)"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "description": "New tags (replaces existing)"
    }
  },
  "required": ["id"]
}
```

**Response:** `NodeResponse` (the updated node)

**Note:** At least one of `title`, `content`, or `tags` must be provided.

**Link Integrity (MVP Behavior):** Renaming `title` changes the file path (ID), which would break incoming `[[wikilinks]]`. For MVP safety:
- If node has incoming links, title changes are **rejected** with `LINK_INTEGRITY` error
- Content and tag updates are always allowed
- See [[roadmap/Link Integrity]] for post-MVP scan-and-update approach

**Error:** Returns error if node doesn't exist or if title change would break links.

---

### delete_node

Delete a node.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Node ID to delete. ID is normalized to lowercase."
    }
  },
  "required": ["id"]
}
```

**Response:** `{ deleted: boolean }`

**Example:**
```json
{ "id": "notes/old-draft.md" }
```

**Returns:**
```json
{ "deleted": true }
```

Returns `{ deleted: false }` if node not found (not an error).

---

### list_nodes

List nodes with optional filters and pagination.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "tag": {
      "type": "string",
      "description": "Filter by tag from the \"tags\" frontmatter array (case-insensitive). Does NOT search other frontmatter fields like \"type\" or \"category\"."
    },
    "path": {
      "type": "string",
      "description": "Filter by path prefix (startsWith, case-insensitive)"
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 1000,
      "default": 100,
      "description": "Maximum results to return"
    },
    "offset": {
      "type": "integer",
      "minimum": 0,
      "default": 0,
      "description": "Skip this many results (for pagination)"
    }
  }
}
```

**Response:** `{ nodes: NodeSummary[], total: number }`

**Example:**
```json
{ "tag": "recipe", "limit": 20 }
```

**Returns:**
```json
{
  "nodes": [
    { "id": "recipes/bulgogi.md", "title": "Bulgogi" },
    { "id": "recipes/kimchi.md", "title": "Kimchi" }
  ],
  "total": 42
}
```

---

### resolve_nodes

Batch resolve names to existing node IDs.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "names": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Names to resolve to existing nodes"
    },
    "strategy": {
      "type": "string",
      "enum": ["exact", "fuzzy", "semantic"],
      "default": "fuzzy",
      "description": "How to match. \"exact\": case-insensitive title equality. \"fuzzy\": string similarity (Dice coefficient) for typos. \"semantic\": embedding cosine similarity for synonyms (NOT typos)."
    },
    "threshold": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "default": 0.7,
      "description": "Minimum similarity score (0-1). Ignored for exact strategy."
    },
    "tag": {
      "type": "string",
      "description": "Filter candidates by tag from \"tags\" frontmatter array (case-insensitive)"
    },
    "path": {
      "type": "string",
      "description": "Filter candidates by path prefix (case-insensitive)"
    }
  },
  "required": ["names"]
}
```

**Response:** `ResolveResult[]`

**Example:**
```json
{ "names": ["bulgogi", "chikken"], "strategy": "fuzzy", "threshold": 0.5 }
```

**Returns:**
```json
[
  { "query": "bulgogi", "match": "recipes/bulgogi.md", "score": 1.0 },
  { "query": "chikken", "match": "recipes/chicken.md", "score": 0.67 }
]
```

---

### nodes_exist

Batch check if node IDs exist.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "ids": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Node IDs to check existence. IDs are normalized to lowercase."
    }
  },
  "required": ["ids"]
}
```

**Response:** `Map<string, boolean>`

**Example:**
```json
{ "ids": ["recipes/bulgogi.md", "recipes/nonexistent.md"] }
```

**Returns:**
```json
{
  "recipes/bulgogi.md": true,
  "recipes/nonexistent.md": false
}
```

---

## Error Handling

### Error Response Shape

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
  }
}
```

### Error Codes

| Code | When | Example |
|------|------|---------|
| `INVALID_PARAMS` | Schema validation failed | Missing required field |
| `NODE_EXISTS` | create_node on existing node | File already exists |
| `NODE_NOT_FOUND` | update_node on missing node | ID doesn't exist |
| `LINK_INTEGRITY` | update_node title change would break links | Node has incoming links |
| `PROVIDER_ERROR` | Provider operation failed | SQLite error, file permission |

### Not Errors

These return successful responses, not errors:

| Scenario | Response |
|----------|----------|
| `get_node` for missing ID | `null` |
| `delete_node` for missing ID | `{ deleted: false }` |
| `find_path` with no path | `null` |
| `search` with no results | `[]` |
| `get_neighbors` with no neighbors | `[]` |

---

## Warnings (Post-MVP)

> **Deferred to post-MVP.** No `_warnings` field in responses currently.

Future: Non-fatal issues (broken links, parse warnings) will be included in a `_warnings` array. See [[roadmap/Warning System]].

---

## Related

- [[MCP Server]] - Implementation overview
- [[GraphCore]] - Underlying operations
- [[Node]] - Data model
- [[decisions/Error Contract]] - Error philosophy
