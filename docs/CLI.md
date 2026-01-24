# CLI

Command-line interface for terminal access.

## Overview

The CLI provides terminal access to Roux. For administration, automation, shell scripts, and local workflows.

## Commands (MVP)

```bash
roux init <directory>     # Install Roux in project (creates roux.yaml, .roux/)
roux serve                # Start MCP server (stdio transport, with file watching)
roux serve --no-watch     # Start without file watching
roux status               # Show stats: node count, edge count, cache freshness
roux viz                  # Generate static HTML graph visualization
roux viz --open           # Generate and open in browser
```

## Workflow

See [[decisions/CLI Workflow]].

**`init`** = Install Roux in project (like `git init`). One-time setup.
- Creates `roux.yaml` with defaults
- Creates `.roux/` directory structure
- Does NOT build cache (that's `serve`'s job)
- On already-initialized directory: no-op, prints config location

**`serve`** = Run Roux. Handles all runtime work.
- Requires prior `init` (fails fast if not initialized)
- Builds/syncs cache on first run or when files changed
- Loads graph into memory, starts MCP server, watches for changes

First `serve` after `init` is slower (building cache, generating embeddings). Subsequent runs are fast.

**Transport:** stdio — Claude Code spawns it as a subprocess. See [[decisions/MCP Transport]].

## Visualization

`roux viz` generates a static HTML file with a D3 force-directed graph.

```bash
roux viz                  # Output to .roux/graph.html
roux viz --output path    # Custom output location
roux viz --open           # Open in browser after generation
```

**Graph features:**
- Nodes sized by in-degree (hubs are larger)
- Edges with directional arrows
- Hover to see node title
- Pan and zoom

Future: live visualization in `roux serve` (see [[roadmap/Serve Visualization]])

## Future Commands

```bash
roux sync                 # Manual resync (rebuild cache without starting server)
roux sync --full          # Full rebuild: regenerate everything
roux search <query>       # Semantic search from terminal
roux get <id>             # Get node by ID
roux create               # Interactive node creation
roux import <file>        # Batch import
roux export <format>      # Export graph
roux health               # Graph health check
```

## Clients

- Terminal users
- Shell scripts
- Cron jobs
- CI/CD pipelines

## Use Cases

**Setup and Maintenance**
- Initialize a new graph
- Rebuild after major changes
- Check system status

**Automation**
- Scheduled syncs
- Import pipelines
- Health checks in CI

**Local Workflows**
- Quick searches without spinning up server
- One-off node creation
- Export for backup

## Implementation Notes

Built with Commander.js. Commands map to [[GraphCore]] operations.

**Progress indicator:** `roux serve` on first run generates embeddings for all nodes. Progress is required: `[12/200] Generating embeddings...`

Command structure can evolve (add commands freely). Changing existing command signatures requires migration guidance.

## Related

- [[GraphCore]] — Provides the operations
- [[GPI]] — What the CLI exposes
- [[MCP Server]] — Alternative interface for AI
- [[API]] — Alternative interface for web apps
- [[Config]] — Configuration file created by init
- [[decisions/CLI Workflow]] — init/serve relationship
- [[decisions/MCP Transport]] — stdio vs SSE transport decision
- [[decisions/Error Output]] — Error/warning output behavior
