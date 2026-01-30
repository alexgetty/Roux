---
title: Readme
---
# Roux

A **Graph Programming Interface (GPI)** for markdown knowledge bases. Semantic search, graph traversal, and AI-assisted editing through MCP.

## What It Does

- **Semantic search** — Find notes by meaning, not just keywords
- **Graph traversal** — Follow wiki-links, find paths, identify hub notes
- **CRUD operations** — Create, read, update, delete notes programmatically
- **MCP integration** — Works with Claude Code and other MCP clients

Point it at a markdown directory. Query it like a graph database. Edit in Obsidian.

## Architecture

```
┌─────────────────────────────┐
│        MCP Server           │  Claude Code, other clients
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│          GraphCore          │  Orchestration hub
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│          Providers          │
│  DocStore + Transformers.js │
└─────────────────────────────┘
```

**Current implementation:**
- **DocStore** — Reads markdown directories, parses frontmatter and wiki-links
- **Transformers.js** — Local embeddings, no external API required
- **SQLite cache** — Fast queries without re-parsing files

## Quick Start

```bash
# Install
npm install -g @gettymade/roux

# Initialize on your markdown directory
cd ~/my-notes
roux init
```

`roux init` creates config files that Claude Code detects automatically. The MCP server starts when you open the project.

Then ask Claude things like:
- "Search my notes for distributed systems"
- "What links to my consensus algorithms note?"
- "Create a new note about today's meeting"

### Requirements
- Node.js 20+
- Markdown files with optional wiki-links (`[[like this]]`)

### CLI Commands

```bash
roux init [directory]     # Initialize (creates roux.yaml, .roux/, .mcp.json)
roux serve [directory]    # Start MCP server manually (for debugging or non-Claude clients)
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

### Non-Claude MCP Clients

`roux init` creates `.mcp.json` which Claude Code reads automatically. Other MCP clients may need manual configuration:

```bash
# Option 1: Run the server manually
roux serve

# Option 2: Configure your client to spawn it (check your client's docs)
```

## Future

The architecture supports pluggable backends. Currently only DocStore exists—these are planned:

- **Additional stores** — Neo4j, SQLite-native, SurrealDB
- **Cloud embeddings** — OpenAI, Ollama for higher-quality vectors
- **LLM provider** — Text generation for assisted writing
- **REST API** — For non-MCP integrations

See `docs/roadmap/` for details.

## How It Works

1. **Parsing** — Reads files, extracts frontmatter and wiki-links
2. **Caching** — Stores parsed nodes in SQLite for fast access
3. **Embedding** — Generates semantic vectors using local transformers.js
4. **Graph** — Builds in-memory graph from link relationships
5. **Serving** — Exposes operations via MCP protocol

File changes sync automatically when the MCP server is running.

## Documentation

Architecture and design decisions live in `docs/`:
- [GPI](docs/GPI.md) — The conceptual frame
- [GraphCore](docs/GraphCore.md) — The orchestration hub
- [MVP](docs/MVP.md) — Current scope and success criteria
- [Implementation Plan](docs/implementation-plan.md) — Full roadmap

## License

MIT
