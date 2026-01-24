# Roux

A Graph Programming Interface (GPI) for knowledge bases. Query your markdown files with semantic search and graph traversal via MCP.

## Quick Start

```bash
# Install
npm install -g roux

# Initialize on your markdown directory
cd ~/my-notes
roux init

# Start the MCP server
roux serve
```

## What It Does

Roux turns a folder of interconnected markdown files into a queryable knowledge graph:

- **Semantic search** — Find notes by meaning, not just keywords
- **Graph traversal** — Follow links, find paths between concepts, identify central nodes
- **AI co-authoring** — Let Claude (or any MCP client) read, create, and update notes
- **Human-editable** — Files stay as plain markdown, no lock-in

## Requirements

- Node.js 20+
- Markdown files with optional wiki-links (`[[like this]]`)

## CLI Commands

```bash
roux init [directory]     # Initialize Roux (creates roux.yaml, .roux/, .mcp.json)
roux serve [directory]    # Start MCP server with file watching
roux serve --no-watch     # Start without watching for file changes
roux status [directory]   # Show node/edge/embedding counts
roux viz [directory]      # Generate interactive graph visualization
roux viz --open           # Generate and open in browser
```

## MCP Tools

When running via `roux serve`, these tools are available to MCP clients:

| Tool | Description |
|------|-------------|
| `search` | Semantic similarity search |
| `get_node` | Get node with optional neighbor context |
| `get_neighbors` | Get linked nodes (in/out/both) |
| `find_path` | Shortest path between nodes |
| `get_hubs` | Most central nodes by in-degree |
| `search_by_tags` | Filter by frontmatter tags |
| `random_node` | Random discovery |
| `create_node` | Create new markdown file |
| `update_node` | Update existing file |
| `delete_node` | Delete file |

## Configuration

Minimal `roux.yaml` (created by `roux init`):

```yaml
providers:
  store:
    type: docstore
```

Embeddings use local transformers.js by default. No external services required.

## Claude Code Integration

`roux init` automatically creates `.mcp.json` in your project directory. Claude Code will prompt you to approve the MCP server on first use.

No manual configuration needed — just:

```bash
cd ~/my-notes
roux init
# Open the directory in Claude Code
# Claude will detect .mcp.json and offer to enable the roux server
```

Then ask Claude things like:
- "Search my notes for distributed systems concepts"
- "What links to my note on consensus algorithms?"
- "Create a new note summarizing what I learned today"

## How It Works

1. **Parsing** — Reads markdown files, extracts frontmatter and wiki-links
2. **Caching** — Stores parsed nodes in SQLite for fast access
3. **Embedding** — Generates semantic vectors using local transformers.js
4. **Graph** — Builds in-memory graph from wiki-link relationships
5. **Serving** — Exposes all operations via MCP protocol

File changes sync automatically when running `roux serve`.

## License

MIT
