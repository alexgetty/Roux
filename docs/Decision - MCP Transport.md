# Decision - MCP Transport

**Status:** Decided
**Affects:** [[MCP Server]], [[CLI]], [[Config]]

## Problem

MCP Server needs to communicate with clients (Claude Code, other MCP clients). The MCP SDK supports multiple transports:

- **stdio**: Server reads stdin, writes stdout. Client spawns server as subprocess.
- **SSE (Server-Sent Events)**: HTTP-based. Server runs independently, client connects via URL.

The choice affects:
- How users configure Claude Code to find Roux
- Whether `roux serve` is a long-running daemon or spawned per-session
- Resource usage (one server vs many)
- Debugging experience

## Options

### Option A: stdio only ✓ SELECTED

```bash
# Claude Code config
{
  "mcpServers": {
    "roux": {
      "command": "roux",
      "args": ["serve"]
    }
  }
}
```

**Pros:**
- Standard MCP pattern (most MCP servers use this)
- No port management
- Clean process lifecycle (dies with client)
- Works behind firewalls, no network exposure
- Zero setup — Claude Code handles spawning

**Cons:**
- One server per client session
- Can't share state between clients
- Cold start on every new session
- Harder to debug (no curl access)

**Decision:** stdio for MVP. Cold start is fast enough (graph loads from SQLite in <100ms at 500 nodes per [[Decision - Graphology Lifecycle]]). No need for graph persistence across sessions. SSE deferred to roadmap for multi-client/production scenarios.

### Option B: SSE (HTTP) only

```bash
# Start server
roux serve --port 3000

# Claude Code config
{
  "mcpServers": {
    "roux": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

**Pros:**
- Single server, multiple clients
- Easy to debug (curl, browser)
- Can add REST endpoints alongside MCP
- Persistent state

**Cons:**
- Port management (conflicts, security)
- Must run server manually before using
- Network exposure concerns
- Less standard for MCP

### Option C: Both (stdio default, SSE optional)

```bash
roux serve              # stdio mode (default)
roux serve --http 3000  # SSE mode on port 3000
```

**Pros:**
- Flexibility
- stdio for normal use, SSE for debugging/multi-client
- Best of both worlds

**Cons:**
- Two code paths to maintain
- User confusion about which to use
- Configuration complexity

### Option D: stdio with optional debug HTTP

```bash
roux serve                    # stdio mode
roux serve --debug-port 3001  # stdio + HTTP debug interface
```

**Pros:**
- stdio is primary (simple, standard)
- Debug port for inspection without changing main transport
- Clear separation of concerns

**Cons:**
- Debug-only HTTP may confuse users who want multi-client

## Considerations

- Claude Code documentation recommends stdio for local tools
- Most community MCP servers use stdio
- File watcher benefits from persistent server (SSE)
- MVP is single-user, single-client scenario
- `roux status` could use HTTP internally to query running server

## Questions to Resolve

1. ~~Is multi-client a real MVP requirement or future?~~ Future. MVP is single-client.
2. ~~How important is debugging access via HTTP?~~ Not critical for MVP. Logs sufficient.
3. ~~Should file watching persist across Claude Code sessions?~~ No. Graph rebuilds fast from SQLite. No persistence needed.

## Decision

**Option A: stdio only for MVP.**

Claude Code spawns Roux as a subprocess. Graph loads from SQLite on each session start. Process dies when Claude Code closes.

SSE (standalone server mode) deferred to roadmap for:
- Multi-client scenarios
- Production deployments
- Long-running servers with persistent state

## Outcome

Decided. MVP uses stdio transport exclusively. The `roux serve` command runs in stdio mode by default. No `--port` or `--http` flags for MVP.

## Related

- [[Decisions]] — Decision hub
- [[MCP Server]] — Implementation
- [[CLI]] — serve command
