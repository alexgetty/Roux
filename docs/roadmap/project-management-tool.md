---
id: Z4YnLab5zD7x
title: Project Management Tool
tags:
  - roadmap
  - tooling
  - dogfooding
---
# Project Management Tool

A Roux-powered project docs and task management system. Dogfooding opportunity that stress-tests Roux as a consumed library while solving real workflow pain.

## Problem

Current `docs/issues/` and `docs/roadmap/` setup is breaking down:
- Agents create issues without checking for duplicates
- Completed tasks aren't closed/archived
- Manual auditing to prevent staleness is eating time
- No enforcement layer—MCP tools are opt-in and frequently ignored
- No visibility into dependencies or build order

## Solution

A tightly integrated, locally-run PM tool with three layers:

### Enforcement Layer (Claude Code Hooks)
- `pre-tool-use`: Block/merge duplicate issue creation via semantic search
- `post-tool-use`: Auto-close issues when related work completes
- Context injection before task execution (pull relevant graph neighbors)
- Agents can't bypass—hooks intercept at the shell level

### Intelligence Layer (Roux + LLM)
- Semantic dedup with merge proposals (threshold ~0.85, human approves)
- Auto-classification: bug / feature / roadmap item
- Dependency inference from document content
- Task extraction from conversations (Claude sessions first, then email/Slack/etc.)

### Visibility Layer (UI)
Three temporal views over task lifecycle:
- **Roadmap**: Future/planned work, DAG with dependency edges
- **Board**: Current/active tasks, kanban-style
- **Issues**: Bugs/defects, often blocking or spawned from board items

"Execute task" button spawns Claude Code with full context injection.

## Design Principles

Follow Obsidian's philosophy:
- Local-first, your files, your data
- Markdown-native (works with or without the tool)
- The tool is a lens, not a prison

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage | DocStore (Roux) | Dogfooding; markdown files in repo |
| Initial UI | Obsidian plugin | Speed to learning; inherit editor/hotkeys |
| Future UI | Electron | Full control over DAG rendering, task execution |
| Enforcement | Claude Code hooks | Can't be bypassed; zero dependencies |

## Implementation Path

1. **Hooks first** — Build and refine in Roux repo over coming days
2. **Schema second** — Define task node structure (status, priority, deps, type)
3. **Break out repo** — When hooks are proven, create standalone project
4. **Obsidian plugin** — MVP visibility layer
5. **Electron app** — When plugin constraints bite

## Task Schema (Draft)

```yaml
---
type: task
status: planned | active | done | blocked
priority: p0 | p1 | p2 | p3
category: feature | bug | chore | research
blocks: []      # task IDs this blocks
blocked_by: []  # task IDs blocking this
---
```

## Open Questions

- [ ] Exact hook trigger patterns for dedup and auto-close
- [ ] Merge UX: how to present candidates for approval?
- [ ] Dependency visualization: timeline vs DAG vs hybrid?
- [ ] How does "execute task" know which model/context to use?

## Links

- [[Claude Code Hooks]] — Enforcement mechanism
- [[DocStore]] — Storage provider
- [[GPI]] — API surface the tool consumes
