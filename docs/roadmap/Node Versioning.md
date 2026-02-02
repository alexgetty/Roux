---
id: Db3i1sqCD19j
title: Node Versioning
tags:
  - roadmap
type: Feature
status: Proposed
priority: P3
effort: L
phase: Future
category: Storage & Providers
---
# Feature - Node Versioning

Track history of node changes.

## Summary

Maintain version history for nodes, enabling rollback and diff views.

## Current State

MVP: Last write wins. No history.

## Use Cases

- **Rollback:** Undo accidental changes
- **Diff view:** See what changed between versions
- **Audit trail:** Who changed what, when
- **Branching:** Experimental edits without affecting main

## Proposed

Version metadata:
```typescript
interface NodeVersion {
  id: string;
  nodeId: string;
  version: number;
  content: string;
  timestamp: Date;
  author?: string;
  message?: string;
}
```

## Storage Options

### 1. SQLite versions table
Store full content per version. Simple but storage-heavy.

### 2. Git-backed
Use git repo as backend. Rich history, familiar tooling.

### 3. Delta storage
Store diffs only. Space-efficient but complex.

## MCP Tools

- `get_node_history` — List versions
- `get_node_version` — Get specific version
- `restore_node_version` — Rollback to version

## Complexity

Medium-High — storage design, versioning strategy, new tools.

## References

- [[Node]] — Current model
- [[DocStore]] — Storage layer
