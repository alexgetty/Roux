# CLI

Command-line interface for terminal access.

## Overview

The CLI provides terminal access to Roux. For administration, automation, shell scripts, and local workflows.

## Commands (MVP)

```bash
roux init <directory>     # Scan directory, build cache, generate embeddings
roux serve                # Start MCP server with file watching
roux serve --no-watch     # Start without file watching
roux sync                 # Manual resync (rarely needed)
roux sync --full          # Full rebuild: regenerate everything
roux status               # Show stats: node count, edge count, cache freshness
```

## Future Commands

```bash
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

Built with standard Node.js CLI patterns. Commands map to [[GraphCore]] operations.

Command structure can evolve (add commands freely). Changing existing command signatures requires migration guidance.

## Related

- [[GraphCore]] — Provides the operations
- [[GPI]] — What the CLI exposes
- [[MCP Server]] — Alternative interface for AI
- [[API]] — Alternative interface for web apps
