---
id: aVEWMEZWZfqp
title: Plugin Hot Reload
tags:
  - roadmap
type: Feature
status: Proposed
priority: P3
effort: M
phase: Future
category: Plugin System
parent: '[[Plugin System]]'
---
# Plugin Hot Reload

Reload plugins without restarting Roux.

## Context

[[Plugin System]] MVP requires restart to load plugin changes. This item was suggested by a previous assistant — Alex has indicated low interest.

## Problem

During plugin development, restarting Roux for every change is slow. Hot reload would enable faster iteration.

## Proposal

```typescript
// CLI command
roux plugin reload plugin-pm

// Or watch mode
roux plugin watch plugin-pm
```

### Challenges

1. **State cleanup** — Plugin may have registered listeners, cached data, open handles
2. **Active MCP connections** — Clients using plugin tools mid-reload
3. **Schema registry** — Need to re-register without losing validation state
4. **In-flight operations** — What happens to pending async work?

### Implementation Sketch

1. Call `unregister()` on old plugin instance
2. Clear plugin's tools from MCP server
3. Clear plugin's schema from registry
4. Re-import plugin module (clear require cache)
5. Create new instance, call `register()`
6. Re-add tools and schema

### Watch Mode

Use `chokidar` or similar to watch plugin directory:
- On `.ts`/`.js` change, rebuild and reload
- Debounce rapid changes
- Show reload status in terminal

## Why Deferred

- Alex indicated low interest
- Restart is acceptable for MVP development pace
- Hot reload complexity is high for edge cases
- Risk of subtle state bugs from partial reloads

## References

- Red-team audit (2026-01-25)
- [[Plugin System]]
