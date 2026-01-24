# MCP Tools Schema

Exact specifications for all MCP tools. Phase 9 implements these verbatim.

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

Link titles provide semantic context for LLM reasoning. The StoreProvider resolves IDs to titles:
- **DocStore**: Derives title from file path (zero IO)
- **Neo4jStore**: Batch queries for title property (one round-trip)

This abstraction keeps MCP store-agnostic while enabling rich context. See `StoreProvider.resolveTitles()`.

### NodeWithContextResponse

Extended response for `get_node` with depth > 0.

```typescript
interface NodeWithContextResponse extends NodeResponse {
  neighbors: NodeResponse[];  // Adjacent nodes (truncated content)
  incomingCount: number;      // Nodes linking TO this node
  outgoingCount: number;      // Nodes this links TO
}
```

**Requirement:** Implementation must differentiate incoming vs outgoing neighbors in the `neighbors` array. Options:
1. Split into `incomingNeighbors` / `outgoingNeighbors` arrays
2. Add `direction: 'in' | 'out'` field to each neighbor
3. Return neighbors in order: outgoing first, then incoming (with counts as boundaries)

Decision needed during Phase 9 implementation.

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
  score: number;  // Metric value (in_degree count, pagerank, etc.)
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

**Required provider:** EmbeddingProvider (tool hidden if not configured)

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
    }
  },
  "required": ["query"]
}
```

**Response:** `SearchResultResponse[]`

**Future:** `threshold` parameter (0-1 min similarity) deferred. See Post-MVP in [[MVP Implementation Plan]].

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
      "description": "Node ID (file path for DocStore)"
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
  "neighbors": [
    {
      "id": "notes/storeprovider.md",
      "title": "StoreProvider",
      "content": "Data persistence and graph op... [truncated]",
      "tags": ["provider"],
      "links": [
        { "id": "notes/node.md", "title": "Node" }
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
      "description": "Source node ID"
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
      "description": "Start node ID"
    },
    "target": {
      "type": "string",
      "description": "End node ID"
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

**Future:** `pagerank` metric deferred. See Post-MVP in [[MVP Implementation Plan]].

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
    "title": {
      "type": "string",
      "description": "Node title (becomes filename for DocStore)"
    },
    "content": {
      "type": "string",
      "description": "Full text content (markdown)"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "default": [],
      "description": "Classification tags"
    },
    "directory": {
      "type": "string",
      "description": "Optional: subdirectory path (e.g., 'notes/drafts')"
    }
  },
  "required": ["title", "content"]
}
```

**Response:** `NodeResponse` (the created node)

**Example:**
```json
{
  "title": "Meeting Notes 2024-01-15",
  "content": "# Meeting Notes\n\nDiscussed project timeline...",
  "tags": ["meeting", "project-x"],
  "directory": "meetings"
}
```

**Behavior:**
- Creates file at `{directory}/{title}.md` (or `{title}.md` if no directory)
- If directory doesn't exist, create it
- Title sanitized for filesystem (spaces → hyphens, lowercase)
- Fails if file already exists

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
      "description": "Node ID to update"
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

**⚠️ CRITICAL - Link Integrity:** Renaming `title` changes the file path (ID), which breaks incoming `[[wikilinks]]` from other nodes. This must be handled before MVP ships. Options:
1. Scan and update all incoming links (expensive but correct)
2. Reject title changes that would break links (safe but limiting)
3. Track old→new ID mapping for resolution (complex)

See [[MVP Implementation Plan]] Phase 9 requirements.

**Error:** Returns error if node doesn't exist.

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
      "description": "Node ID to delete"
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

## Warnings

Non-fatal issues are included in a `_warnings` array:

```json
{
  "id": "notes/example.md",
  "title": "Example",
  "content": "...",
  "tags": [],
  "links": [
    { "id": "notes/related.md", "title": "Related" }
  ],
  "_warnings": [
    "Broken link: [[missing-note]]",
    "Duplicate tag ignored: tutorial"
  ]
}
```

Warnings accumulate from file watcher and clear after being returned.

---

## Related

- [[MCP Server]] - Implementation overview
- [[GraphCore]] - Underlying operations
- [[Node]] - Data model
- [[decisions/Error Contract]] - Error philosophy
