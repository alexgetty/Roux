# MVP: Personal Knowledge Base

First use case for Roux. Validates core architecture with minimal infrastructure.

## The Scenario

You maintain a directory of interconnected markdown files—research notes, project documentation, reference material. You use Obsidian (or similar) to author and browse, taking advantage of [[Wiki-links|wiki-style links]] to connect related concepts.

You want to query this knowledge programmatically:
- **Semantic search**: Find notes by meaning, not just keyword
- **Graph traversal**: Follow links, find paths between concepts, identify central nodes
- **AI co-authoring**: Let Claude Code (or any MCP client) read, create, and update notes as part of your workflow
- **Human-editable**: Files remain plain markdown—no lock-in, no proprietary format
- LLMs can reference relevant docs when planning or implementing code for modular project context.

## Why This Use Case

This validates the core architecture with minimal infrastructure:
- [[DocStore]] proves the [[StoreProvider]] interface works for non-native-graph data
- [[Graph Projection]] logic gets built and tested
- [[MCP Server]] integration proves the external interface
- Real usage generates feedback before building heavier stores

The same query patterns—search, traverse, identify hubs—apply whether you're asking "what do I know about X?" in a personal knowledge base or building a recommendation engine in a product.

## Scope

### In Scope

**Storage:**
- [[DocStore]] only (markdown files with SQLite cache, no html or other doc types)
- Single directory (no federation)

**Providers:**
- [[StoreProvider]]: DocStore implementation
- [[EmbeddingProvider]]: [[Transformers|transformers.js]] default (zero config), Ollama/OpenAI optional
- LLMProvider: Deferred to Phase 0.5

**Interfaces:**
- [[MCP Server]]: Primary interface
- [[CLI]]: `init`, `serve`, `sync`, `status`

**Operations:**
- CRUD: create, read, update, delete nodes
- Search: semantic similarity (requires embeddings)
- Graph: neighbors, path finding, hub identification
- Tags: filter by tags

### Out of Scope

- Other stores (Neo4j, SurrealDB, etc.)
- REST/GraphQL API
- Multi-directory federation
- LLM-assisted features (summarize, suggest tags)
- Structural embeddings (research phase)
- Concurrent access handling (single client assumed)
- Conflict resolution (last write wins)

## Success Criteria

MVP is complete when:

1. **Init works**: `roux init` on a document directory completes, generates cache
2. **Search works**: `search("concept")` returns semantically relevant nodes
3. **Graph traversal works**: `get_neighbors`, `find_path`, `get_hubs` return correct results
4. **Write works**: `create_node` creates valid document with frontmatter
5. **Update works**: `update_node` modifies file, links update correctly
6. **File watcher works**: Modify file externally → changes reflected in queries within 1 second
7. **Tested at scale**: Works on directory with 500+ nodes without degraded performance

## User Journey

```
1. Install
   npm install -g roux

2. Initialize
   cd ~/my-notes
   roux init .
   # Creates roux.yaml config and .roux/ directory

3. Serve
   roux serve
   # Builds cache, generates embeddings, starts MCP server, watches for changes

4. Use via Claude Code (or any MCP client)
   "Search my notes for distributed systems concepts"
   "What links to my note on consensus algorithms?"
   "Create a new note summarizing what I learned today"

5. Edit in Obsidian
   # Changes reflect in queries within 1 second
```

## CLI Commands

See [[CLI]] for full details.

```bash
roux init <directory>     # Create config and .roux/ directory
roux serve                # Build cache, start MCP server, watch for changes
roux serve --no-watch     # Start without file watching
roux status               # Show stats: node count, edge count, cache freshness
```

## MCP Tools (MVP)

See [[MCP Server]] for full parameter specifications.

| Tool | Description |
|------|-------------|
| `search` | Semantic search (requires EmbeddingProvider) |
| `get_node` | Get node with optional neighbor context |
| `get_neighbors` | Get linked nodes (in/out/both) |
| `find_path` | Shortest path between nodes |
| `get_hubs` | Most central nodes by metric |
| `search_by_tags` | Filter by tags (any/all) |
| `random_node` | Random discovery |
| `create_node` | Create document |
| `update_node` | Update document |
| `delete_node` | Delete document |

## Sync Behavior

**Write-through (MCP operations):**
- `create_node`, `update_node`, `delete_node` → immediately update cache
- No delay—writes are instantly queryable

**File watcher (external edits):**
- Monitor directory while server runs
- File changed → update that node's cache
- File deleted → remove from cache
- New file → parse and add to cache
- Target latency: <1 second for changes to reflect

## Configuration

See [[Config]] for full schema. Minimal MVP config:

```yaml
providers:
  store:
    type: docstore
```

That's it. Embeddings use [[Transformers|transformers.js]] by default. No external services required.

## Dependencies

**Runtime:** Node.js 20+

**Core packages:**
- `@modelcontextprotocol/sdk` — MCP protocol
- `@xenova/transformers` — Local embeddings (default)
- `graphology` — Graph operations
- `chokidar` — File system monitoring
- `yaml` — Config + frontmatter parsing

**Optional:** Ollama or OpenAI for higher quality embeddings

## Related

- [[implementation-plan]] — Full roadmap
- [[MCP Server]] — Tool specifications
- [[DocStore]] — Storage implementation
- [[Config]] — Configuration schema
