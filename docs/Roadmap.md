# Roadmap

Central hub for future work. Each feature is a separate note with `type: Roadmap Feature` for Obsidian queryability.

## How to Use

**Adding a feature:** Create a new note with frontmatter:
```yaml
---
type: Roadmap Feature
status: Proposed | Planned | In Progress | Done
priority: Low | Medium | High | Critical
phase: Post-MVP | Phase 0.5 | Future
parent: "[[Parent Doc]]"
---
```

**Querying (Obsidian Dataview):**
```dataview
TABLE status, priority, phase
FROM "docs"
WHERE type = "Roadmap Feature"
SORT priority DESC
```

---

## Phase 0.5: LLM Features

| Feature | Status | Priority |
|---------|--------|----------|
| [[roadmap/LLMProvider]] | Planned | High |

---

## Post-MVP

| Feature | Status | Priority |
|---------|--------|----------|
| [[roadmap/Search Threshold]] | Proposed | Low |
| [[roadmap/List Tags Tool]] | Proposed | Low |
| [[roadmap/Pagination]] | Proposed | Medium |
| [[roadmap/PageRank Metric]] | Proposed | Medium |
| [[roadmap/Link Integrity]] | Proposed | Critical |
| [[roadmap/Inline Tags]] | Proposed | Medium |
| [[roadmap/Aliases]] | Proposed | Medium |
| [[roadmap/Fragment Links]] | Proposed | Low |
| [[roadmap/Neighbor Direction]] | Proposed | Medium |

---

## Future (Unscheduled)

| Feature | Status | Priority |
|---------|--------|----------|
| [[roadmap/SSE Transport]] | Proposed | Medium |
| [[roadmap/Typed Edges]] | Proposed | Medium |
| [[roadmap/VectorProvider]] | Proposed | Low |
| [[roadmap/sqlite-vec]] | Proposed | Low |
| [[roadmap/Non-Markdown Formats]] | Proposed | Low |
| [[roadmap/Multi-Directory]] | Proposed | Medium |
| [[roadmap/REST API]] | Proposed | Low |
| [[roadmap/Alternative Stores]] | Proposed | Low |
| [[roadmap/Node Versioning]] | Proposed | Low |
| [[roadmap/Frontmatter ID]] | Proposed | Low |
| [[roadmap/Config Env Vars]] | Proposed | Low |

---

## Related

- [[MVP]] — Current scope
- [[MVP Implementation Plan]] — Active development
- [[Decisions]] — Architectural decisions
