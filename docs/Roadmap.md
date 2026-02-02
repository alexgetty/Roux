---
id: e2ejKi3LflHS
title: Roadmap
tags:
  - roadmap
  - index
---
# Roadmap

Central hub for future work. 84 active items across 10 categories (6 archived, 1 duplicate removed).

## Metadata Schema

```yaml
---
type: Feature | Enhancement | Infrastructure | Epic | RFC
status: Proposed | Planned | In Progress | Done
priority: P0 | P1 | P2 | P3
effort: S | M | L | XL
category: Graph & Links | Search & Query | Storage & Providers | MCP Tools | External APIs | Infrastructure | CLI & Visualization | Release | Plugin System | Testing
milestone: "1.0" | "2.0" | null
release: null
tags: [roadmap]
---
```

---

## 1.0 Vision

Strategic direction for Roux 1.0. See [[roadmap/1.0 Vision - Index]] for the complete picture.

### Infrastructure (11 items)

| Item | Status | Description |
|------|--------|-------------|
| [[roadmap/1.0 Vision - Node Schema]] | Designed | Context-based namespacing |
| [[roadmap/1.0 Vision - Multi-Source Graph Federation]] | Planned | Unified multi-repo graphs |
| [[roadmap/1.0 Vision - Universal Text Node Support]] | Partial | Any text file as node |
| [[roadmap/1.0 Vision - Semantic Layer]] | Implemented | Embeddings and similarity |
| [[roadmap/1.0 Vision - Structural Traversal]] | Implemented | Graph primitives |
| [[roadmap/1.0 Vision - Mutation Tracing]] | Planned | Audit and replay |
| [[roadmap/1.0 Vision - Pluggable Providers]] | Implemented | Swap storage/embeddings/LLMs |
| [[roadmap/1.0 Vision - Hook System]] | Planned | Event-driven triggers |
| [[roadmap/1.0 Vision - Content-Agnostic Linking]] | Partial | Multiple link syntaxes |
| [[roadmap/1.0 Vision - Query Composition]] | Planned | Complex query builder |
| [[roadmap/1.0 Vision - Ontology System]] | Designed | Optional type system |

### Applications (6 items)

| Item | Description |
|------|-------------|
| [[roadmap/1.0 Vision - Applications]] | Index of apps built on GPI |
| [[roadmap/1.0 Vision - IDE Context Extension]] | Human-facing ContextEngine |
| [[roadmap/1.0 Vision - Decision Journal]] | Structured decision tracking |
| [[roadmap/1.0 Vision - Conversation Graph]] | Meetings/chat as knowledge |
| [[roadmap/1.0 Vision - Changelog Generator]] | Semantic changelogs |
| [[roadmap/1.0 Vision - Competitive Intelligence Tracker]] | Auto-research competitors |

---

## Epics

### Plugin System (9 items)

Modular extension system for Roux.

| Item | Priority | Effort | Status |
|------|----------|--------|--------|
| [[roadmap/Plugin System]] | P1 | XL | Planned |
| [[roadmap/Plugin Architecture Prep]] | P1 | L | Planned |
| [[roadmap/Plugin Schema Migration]] | P2 | L | Proposed |
| [[roadmap/Plugin Sandboxing]] | P2 | L | Proposed |
| [[roadmap/Plugin MCP Integration]] | P2 | M | Proposed |
| [[roadmap/Plugin Cross Communication]] | P2 | M | Proposed |
| [[roadmap/Plugin Schema Composition]] | P3 | M | Proposed |
| [[roadmap/Plugin Hot Reload]] | P3 | M | Proposed |
| [[roadmap/Plugin Marketplace]] | P3 | XL | Proposed |

### Testing Framework (8 items)

Graph health checks and validation framework.

| Item | Priority | Effort | Status |
|------|----------|--------|--------|
| [[roadmap/Testing Framework]] | P1 | XL | Planned |
| [[roadmap/Testing Infrastructure Request - Eldhrimnir]] | P2 | S | Proposed |
| [[roadmap/Testing Infrastructure Request - Gettyverse]] | P2 | S | Proposed |
| [[roadmap/Testing Infrastructure Request - The Dataverse]] | P2 | S | Proposed |
| [[roadmap/Scale Testing]] | P2 | M | Proposed |
| [[roadmap/Scale Testing For MCP Handlers]] | P3 | S | Proposed |
| [[roadmap/Batch Operations Scale Testing]] | P3 | S | Proposed |
| [[roadmap/Test Coverage Extensions]] | P3 | M | Proposed |

---

## Categories

### Graph & Links (6 items)

| Item | Priority | Effort | Status |
|------|----------|--------|--------|
| [[roadmap/Link Integrity]] | P0 | L | Proposed |
| [[roadmap/Aliases]] | P2 | M | Proposed |
| [[roadmap/Auto Linking]] | P2 | L | Proposed |
| [[roadmap/Inline Tags]] | P2 | S | Proposed |
| [[roadmap/Typed Edges]] | P2 | L | Proposed |
| [[roadmap/Fragment Links]] | P3 | M | Proposed |

### Search & Query (8 items)

| Item | Priority | Effort | Status |
|------|----------|--------|--------|
| [[roadmap/PageRank Metric]] | P2 | M | Proposed |
| [[roadmap/Property Based Filtering]] | P2 | M | Proposed |
| [[roadmap/Search Threshold]] | P3 | S | Proposed |
| [[roadmap/Search Default Limit]] | P3 | S | Proposed |
| [[roadmap/List Tags Tool]] | P3 | S | Proposed |
| [[roadmap/Resolve Threshold Validation]] | P3 | S | Proposed |
| [[roadmap/Vector Search Tie Breaking]] | P3 | S | Proposed |

### Storage & Providers (12 items)

| Item | Priority | Effort | Status |
|------|----------|--------|--------|
| [[roadmap/LLMProvider]] | P1 | L | Planned |
| [[roadmap/DocStore Post-MVP]] | P2 | M | Proposed |
| [[roadmap/Multi-Directory]] | P2 | L | Proposed |
| [[roadmap/SQLite Vec]] | P2 | M | Proposed |
| [[roadmap/Multi-Store Architecture]] | P2 | L | Proposed |
| [[roadmap/Alternative Stores]] | P3 | XL | Proposed |
| [[roadmap/Frontmatter ID]] | P3 | M | Proposed |
| [[roadmap/Multi Filetype Support]] | P3 | M | Proposed |
| [[roadmap/Node Versioning]] | P3 | L | Proposed |
| [[roadmap/Non-Markdown Formats]] | P3 | M | Proposed |
| [[roadmap/Vector Concurrent Writes]] | P3 | S | Proposed |
| [[roadmap/VectorProvider]] | P3 | L | Proposed |

### MCP Tools (5 items)

| Item | Priority | Effort | Status |
|------|----------|--------|--------|
| [[roadmap/MCP Discovery Only Refactor]] | P1 | M | Planned |
| [[roadmap/Pagination]] | P2 | S | Proposed |
| [[roadmap/Stale Update Prevention]] | P2 | M | Proposed |
| [[roadmap/Handler Dispatch Boilerplate]] | P3 | S | Proposed |
| [[roadmap/Schema Handler Colocation]] | P3 | S | Proposed |

### External APIs (2 items)

| Item | Priority | Effort | Status |
|------|----------|--------|--------|
| [[roadmap/SSE Transport]] | P2 | M | Proposed |
| [[roadmap/REST API]] | P3 | L | Proposed |

### Infrastructure (10 items)

| Item | Priority | Effort | Status |
|------|----------|--------|--------|
| [[roadmap/Developer Tooling]] | P1 | L | Proposed |
| [[roadmap/Project Management Tool]] | P1 | XL | Proposed |
| [[roadmap/Graph Index Extraction]] | P2 | M | Planned |
| [[roadmap/Automated Documentation]] | P2 | M | Planned |
| [[roadmap/Config Env Vars]] | P3 | S | Proposed |
| [[roadmap/Config Parsing Consolidation]] | P3 | S | Proposed |
| [[roadmap/File Watcher Extraction]] | P3 | M | Proposed |
| [[roadmap/Graph Builder Narrower Interface]] | P3 | S | Proposed |
| [[roadmap/GraphCore Concurrent Registration]] | P3 | S | Proposed |
| [[roadmap/ID Normalization Consolidation]] | P3 | S | Proposed |

### CLI & Visualization (4 items)

| Item | Priority | Effort | Status |
|------|----------|--------|--------|
| [[roadmap/Script Extensions]] | P2 | L | Planned |
| [[roadmap/Serve Shutdown Hang]] | P2 | S | Proposed |
| [[roadmap/Serve Visualization]] | P2 | M | Proposed |
| [[roadmap/Viz Theme]] | P3 | S | Proposed |

### Release (2 items)

| Item | Priority | Effort | Status |
|------|----------|--------|--------|
| [[roadmap/Open Source Readiness]] | P1 | M | In Progress |
| [[roadmap/Beta Release Workflow]] | P2 | S | Proposed |

---

## Special Items

| Item | Category | Description |
|------|----------|-------------|
| [[roadmap/Plugin - Schema.org Validator]] | Plugin System | First plugin implementation |

---

## Priority Summary

| Priority | Count | Description |
|----------|-------|-------------|
| **P0** | 1 | Critical - blocks core functionality |
| **P1** | 8 | High - significant value, plan soon |
| **P2** | 28 | Medium - valuable, schedule when ready |
| **P3** | 30 | Low - nice to have, opportunistic |

### P0 (Critical)
- [[roadmap/Link Integrity]] - title rename breaks incoming links

### P1 (High)
- [[roadmap/Plugin System]] - extensibility foundation
- [[roadmap/Plugin Architecture Prep]] - provider prep for plugins
- [[roadmap/Testing Framework]] - graph health validation
- [[roadmap/LLMProvider]] - AI-assisted features
- [[roadmap/MCP Discovery Only Refactor]] - cleaner architecture
- [[roadmap/Developer Tooling]] - DX for consumers
- [[roadmap/Project Management Tool]] - dogfooding Roux
- [[roadmap/Open Source Readiness]] - public release prep

---

## Archive

Completed or superseded items in `docs/roadmap/archive/`. Not tracked here.

---

## Related

- [[MVP]] - Current scope
- [[Decisions]] - Architectural decisions
- [[docs/issues/index]] - Active issues and tech debt
