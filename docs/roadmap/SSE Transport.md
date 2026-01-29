---
type: Feature
status: Proposed
priority: P2
effort: M
phase: Future
category: External APIs
---

# Feature - SSE Transport

Standalone HTTP server with Server-Sent Events transport.

## Summary

Run Roux as a persistent HTTP server instead of stdio subprocess.

## Current State

MVP uses stdio transport. Claude Code spawns `roux serve` as subprocess. Cold start on each session.

## Use Cases

- **Multi-client:** Multiple MCP clients connect to same graph
- **Web dashboard:** Browser-based graph explorer
- **Remote access:** Query graph from different machines
- **Persistent:** No cold start per session

## Proposed

```bash
roux serve --http --port 3000
```

- HTTP server with SSE for MCP protocol
- Same tools, different transport
- Optional authentication (API key, OAuth)

## Implementation

- MCP SDK supports SSE transport
- Add HTTP server wrapper (Express, Fastify, or native)
- Authentication middleware
- CORS configuration

## Complexity

Medium — MCP SDK handles protocol, need HTTP wrapper and auth.

## References

- [[decisions/MCP Transport]] — stdio decision, SSE deferred
- [[MCP Server]] — Tool implementation
