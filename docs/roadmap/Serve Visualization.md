---
id: VmXozLfMWE8o
title: Serve Visualization
tags:
  - roadmap
type: Feature
status: Proposed
priority: P2
effort: M
phase: Post-MVP
category: CLI & Visualization
---
# Feature - Serve Visualization

Built-in graph visualization when running `roux serve`.

## Summary

Embed a visual graph explorer in the serve command, accessible at `localhost:PORT/graph`.

## Current State

MVP: `roux viz` generates a static HTML file for QA inspection.

## Proposed

When `roux serve` runs, include a web-based graph visualization by default:
- Accessible at `/graph` endpoint
- Force-directed layout showing nodes and edges
- Click node to see details
- Search/filter by tags
- Live updates as files change

## Implementation

- Serve static assets (bundled JS/CSS) from the MCP server
- WebSocket for live graph updates on file changes
- Reuse visualization logic from `roux viz`

## Tradeoffs

**Pros:**
- Always available during development
- Live sync with file changes
- No separate command needed

**Cons:**
- Increases bundle size
- May need `--no-viz` flag for headless/production use

## Configuration

```yaml
# roux.yaml
serve:
  visualization: true  # default
  port: 3000
```

Disable via flag: `roux serve --no-viz`

## Complexity

Medium — requires WebSocket integration and bundled frontend assets.

## References

- [[CLI#Serve]] — Serve command spec
- [[MCP Server]] — Transport layer
