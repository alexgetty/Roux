# Roadmap

Central hub for future work. 63 items across 10 categories.

## Metadata Schema

```yaml
---
type: Feature | Enhancement | Infrastructure | Epic | RFC
status: Proposed | Planned | In Progress | Done
priority: P0 | P1 | P2 | P3
effort: S | M | L | XL
phase: Post-MVP | Future
category: <see categories below>
parent: "[[Epic Name]]"      # for sub-items
blockedBy: ["[[Other Item]]"] # dependencies
---
```

**Dataview query:**
```dataview
TABLE status, priority, effort, category
FROM "docs/roadmap"
WHERE type
SORT priority ASC
```

---

## Epics

### Plugin System (8 items)

Modular extension system for Roux. Planned for post-MVP.

| Item | Priority | Effort | Status |
|------|----------|--------|--------|
| [[roadmap/Plugin System]] | P1 | XL | Planned |
| [[roadmap/Plugin Schema Migration]] | P2 | L | Proposed |
| [[roadmap/Plugin Sandboxing]] | P2 | L | Proposed |
| [[roadmap/Plugin MCP Integration]] | P2 | M | Proposed |
| [[roadmap/Plugin Cross Communication]] | P2 | M | Proposed |
| [[roadmap/Plugin Schema Composition]] | P3 | M | Proposed |
| [[roadmap/Plugin Hot Reload]] | P3 | M | Proposed |
| [[roadmap/Plugin Marketplace]] | P3 | XL | Proposed |

### Testing Framework (7 items)

Graph health checks and validation framework. Blocked by Plugin System.

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

| Item | Priority | Effort | Phase |
|------|----------|--------|-------|
| [[roadmap/Link Integrity]] | P0 | L | Post-MVP |
| [[roadmap/Aliases]] | P2 | M | Post-MVP |
| [[roadmap/Auto Linking]] | P2 | L | Future |
| [[roadmap/Inline Tags]] | P2 | S | Post-MVP |
| [[roadmap/Typed Edges]] | P2 | L | Future |
| [[roadmap/Fragment Links]] | P3 | M | Post-MVP |

### Search & Query (8 items)

| Item | Priority | Effort | Phase |
|------|----------|--------|-------|
| [[roadmap/PageRank Metric]] | P2 | M | Post-MVP |
| [[roadmap/Neighbor Direction]] | P2 | S | Post-MVP |
| [[roadmap/Property Based Filtering]] | P2 | M | Post-MVP |
| [[roadmap/Search Threshold]] | P3 | S | Post-MVP |
| [[roadmap/Search Default Limit]] | P3 | S | Post-MVP |
| [[roadmap/List Tags Tool]] | P3 | S | Post-MVP |
| [[roadmap/Resolve Threshold Validation]] | P3 | S | Post-MVP |
| [[roadmap/Vector Search Tie Breaking]] | P3 | S | Post-MVP |

### Storage & Providers (11 items)

| Item | Priority | Effort | Phase |
|------|----------|--------|-------|
| [[roadmap/LLMProvider]] | P1 | L | Post-MVP |
| [[roadmap/DocStore Post-MVP]] | P2 | M | Post-MVP |
| [[roadmap/Multi-Directory]] | P2 | L | Future |
| [[roadmap/SQLite Vec]] | P2 | M | Future |
| [[roadmap/Alternative Stores]] | P3 | XL | Future |
| [[roadmap/Frontmatter ID]] | P3 | M | Future |
| [[roadmap/Multi Filetype Support]] | P3 | M | Future |
| [[roadmap/Node Versioning]] | P3 | L | Future |
| [[roadmap/Non-Markdown Formats]] | P3 | M | Future |
| [[roadmap/Vector Concurrent Writes]] | P3 | S | Post-MVP |
| [[roadmap/VectorProvider]] | P3 | L | Future |

### MCP Tools (5 items)

| Item | Priority | Effort | Phase |
|------|----------|--------|-------|
| [[roadmap/MCP Discovery Only Refactor]] | P1 | M | Post-MVP |
| [[roadmap/Pagination]] | P2 | S | Post-MVP |
| [[roadmap/Stale Update Prevention]] | P2 | M | Post-MVP |
| [[roadmap/Handler Dispatch Boilerplate]] | P3 | S | Post-MVP |
| [[roadmap/Schema Handler Colocation]] | P3 | S | Post-MVP |

### External APIs (2 items)

| Item | Priority | Effort | Phase |
|------|----------|--------|-------|
| [[roadmap/SSE Transport]] | P2 | M | Future |
| [[roadmap/REST API]] | P3 | L | Future |

### Infrastructure (9 items)

| Item | Priority | Effort | Phase |
|------|----------|--------|-------|
| [[roadmap/Developer Tooling]] | P1 | L | Post-MVP |
| [[roadmap/Graph Index Extraction]] | P2 | M | Post-MVP |
| [[roadmap/Automated Documentation]] | P2 | M | Post-MVP |
| [[roadmap/Config Env Vars]] | P3 | S | Future |
| [[roadmap/Config Parsing Consolidation]] | P3 | S | Post-MVP |
| [[roadmap/File Watcher Extraction]] | P3 | M | Post-MVP |
| [[roadmap/Graph Builder Narrower Interface]] | P3 | S | Post-MVP |
| [[roadmap/GraphCore Concurrent Registration]] | P3 | S | Post-MVP |
| [[roadmap/ID Normalization Consolidation]] | P3 | S | Post-MVP |

### CLI & Visualization (4 items)

| Item | Priority | Effort | Phase |
|------|----------|--------|-------|
| [[roadmap/Script Extensions]] | P2 | L | Post-MVP |
| [[roadmap/Serve Shutdown Hang]] | P2 | S | Post-MVP |
| [[roadmap/Serve Visualization]] | P2 | M | Post-MVP |
| [[roadmap/Viz Theme]] | P3 | S | Post-MVP |

### Release (2 items)

| Item | Priority | Effort | Phase |
|------|----------|--------|-------|
| [[roadmap/Open Source Readiness]] | P1 | M | Post-MVP |
| [[roadmap/Beta Release Workflow]] | P2 | S | Post-MVP |

---

## Priority Summary

| Priority | Count | Description |
|----------|-------|-------------|
| **P0** | 1 | Critical — blocks core functionality |
| **P1** | 6 | High — significant value, plan soon |
| **P2** | 24 | Medium — valuable, schedule when ready |
| **P3** | 32 | Low — nice to have, opportunistic |

### P0 (Critical)
- [[roadmap/Link Integrity]] — title rename breaks incoming links

### P1 (High)
- [[roadmap/Plugin System]] — extensibility foundation
- [[roadmap/Testing Framework]] — graph health validation
- [[roadmap/LLMProvider]] — AI-assisted features
- [[roadmap/MCP Discovery Only Refactor]] — cleaner architecture
- [[roadmap/Developer Tooling]] — DX for consumers
- [[roadmap/Open Source Readiness]] — public release prep

---

## Related

- [[MVP]] — Current scope
- [[Decisions]] — Architectural decisions
- [[docs/issues/index]] — Active issues and tech debt
