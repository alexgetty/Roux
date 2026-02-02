---
id: fPJw1wuoOGbL
title: Plugin Cross Communication
tags:
  - roadmap
type: Feature
status: Proposed
priority: P2
effort: M
phase: Future
category: Plugin System
parent: '[[Plugin System]]'
---
# Plugin Cross-Communication

Event system for plugins to react to each other's changes.

## Context

[[Plugin System]] MVP uses polling for cross-plugin communication. Plugins query the store at their own frequency to detect changes. This works but doesn't scale.

## Problem

With polling:
- 10 plugins × 500ms intervals = 20 queries/second
- No coordination → thundering herd on startup  
- Delayed reactions (up to poll interval)
- Wasted queries when nothing changed

## Proposal

Opt-in event system:

```typescript
interface PluginEvents {
  // Subscribe to changes
  on(event: 'node:created' | 'node:updated' | 'node:deleted', 
     filter: EventFilter,
     handler: EventHandler): void;
  
  // Emit custom events (plugin-namespaced)
  emit(event: string, data: unknown): void;
}

// In plugin
async register(core: GraphCore) {
  core.events.on('node:updated', 
    { namespace: 'plugin-pm' },  // only PM plugin's data
    async (node) => {
      // React to PM changes
    }
  );
}
```

### Event Types

- `node:created` — new node added
- `node:updated` — existing node changed  
- `node:deleted` — node removed
- `plugin:{pluginId}:{custom}` — plugin-defined events

### Upgrade Path

Plugins can migrate from polling to events without breaking:
1. Keep polling code as fallback
2. Add event listeners for real-time
3. Event handler sets flag to skip next poll
4. Eventually remove polling code

## Why Deferred

- Polling works for MVP scale
- Event system adds significant complexity
- Need to see real usage patterns first
- Can add without breaking existing plugins

## References

- Red-team audit (2026-01-25)
- [[Plugin System]]
