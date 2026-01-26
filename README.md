---
title: Readme
---
# Roux

A **Graph Programming Interface (GPI)** for building and maintaining knowledge graphs. Semantic search, graph traversal, and AI co-authoring through a unified interface—regardless of storage backend.

## What It Does

- **Semantic search** — Find nodes by meaning, not just keywords
- **Graph traversal** — Follow links, find paths, identify central nodes
- **CRUD operations** — Create, read, update, delete nodes programmatically
- **AI co-authoring** — Let AI assistants read and write knowledge alongside humans

The graph is always the target structure. Data that isn't natively a graph gets transformed during ingestion. The query model stays constant regardless of source or storage.

## Architecture

Roux is a platform of pluggable modules. GraphCore is the coordination hub—it defines provider interfaces but has zero functionality without them.

```
┌─────────────────────────────┐
│     External Interfaces     │  MCP Server, REST API, CLI
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│          GraphCore          │  Orchestration hub
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│          Providers          │  Store, Embedding, LLM, ...
└─────────────────────────────┘
```

**Store backends** span zero infrastructure to enterprise scale:
- File-based: DocStore (markdown directories)
- Embedded: SQLite, LevelGraph
- Standalone: SurrealDB, FalkorDB, Memgraph
- Enterprise: Neo4j, ArangoDB, Amazon Neptune

**Embedding providers** for semantic search:
- Local: transformers.js (default, zero config)
- Self-hosted: Ollama
- Cloud: OpenAI

Same queries, same results—regardless of what's plugged in.

## Current State (v0.1.x)

Roux ships today with **DocStore**: point it at a markdown directory, query via MCP, edit in Obsidian.

```bash
# Install
npm install -g @gettymade/roux

# Initialize on your markdown directory
cd ~/my-notes
roux init

# Start the MCP server
roux serve
```

Then ask your AI things like:
- "Search my notes for distributed systems concepts"
- "What links to my note on consensus algorithms?"
- "Create a new note summarizing what I learned today"

### Requirements
- Node.js 20+
- Markdown files with optional wiki-links (`[[like this]]`)

### CLI Commands

```bash
roux init [directory]     # Initialize (creates roux.yaml, .roux/, .mcp.json)
roux serve [directory]    # Start MCP server with file watching
roux serve --no-watch     # Start without watching for changes
roux status [directory]   # Show node/edge/embedding counts
roux viz [directory]      # Generate interactive graph visualization
roux viz --open           # Generate and open in browser
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `search` | Semantic similarity search |
| `get_node` | Get node with optional neighbor context |
| `get_neighbors` | Get linked nodes (in/out/both) |
| `find_path` | Shortest path between nodes |
| `get_hubs` | Most central nodes by in-degree |
| `search_by_tags` | Filter by frontmatter tags |
| `random_node` | Random discovery |
| `list_nodes` | List with filters and pagination |
| `resolve_nodes` | Batch name-to-ID resolution |
| `nodes_exist` | Batch existence check |
| `create_node` | Create new markdown file |
| `update_node` | Update existing file |
| `delete_node` | Delete file |

### Configuration

Minimal `roux.yaml` (created by `roux init`):

```yaml
providers:
  store:
    type: docstore
```

Embeddings use local transformers.js by default. No external services required.

### MCP Client Integration

`roux init` creates `.mcp.json` in your project directory. MCP clients detect and offer to enable the server automatically.

## Roadmap

**Near term:**
- LLMProvider — Text generation for assisted features
- Structural embeddings — Graph-aware vectors

**Medium term:**
- Neo4jStore — Graph database backend for scale
- IngestionProvider — Entity extraction, edge inference
- REST/GraphQL API

**Future:**
- Multi-store federation
- Multi-tenancy and access control

See [implementation-plan.md](docs/implementation-plan.md) for details.

## How It Works

1. **Parsing** — Reads files, extracts frontmatter and wiki-links
2. **Caching** — Stores parsed nodes in SQLite for fast access
3. **Embedding** — Generates semantic vectors using local transformers.js
4. **Graph** — Builds in-memory graph from link relationships
5. **Serving** — Exposes operations via MCP protocol

File changes sync automatically when running `roux serve`.

## Documentation

Architecture and design decisions live in `docs/`:
- [GPI](docs/GPI.md) — The conceptual frame
- [GraphCore](docs/GraphCore.md) — The orchestration hub
- [MVP](docs/MVP.md) — Current scope and success criteria
- [Implementation Plan](docs/implementation-plan.md) — Full roadmap

## License

MIT
