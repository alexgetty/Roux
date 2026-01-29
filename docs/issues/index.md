---
title: index
tags:
  - index
  - hub
---
# Open Issues

16 active issues across 5 categories.

## Architecture (6)

Structural improvements to reduce complexity and coupling.

| Priority | Issue | Scope |
|----------|-------|-------|
| HIGH | [[mcp-architecture]] | Monolith refactor: split handlers, co-locate schemas |
| MEDIUM | [[docstore-cache-complexity]] | Cache at ~486 lines, SQL generation could be modularized |
| MEDIUM | [[cache-schema-operation-split]] | Schema ownership split across modules |
| MEDIUM | [[file-operations-depends-on-watcher]] | Inverted dependency via EXCLUDED_DIRS import |
| LOW | [[docstore-constructor-options-object]] | Positional params susceptible to ordering bugs |
| MEDIUM | [[filewatcher-issues]] | 5 consolidated watcher bugs and test gaps |

## Performance (2)

| Priority | Issue | Scope |
|----------|-------|-------|
| MEDIUM | [[getneighbors-fetches-all-neighbor-ids]] | Fetches all neighbor IDs then slices |
| MEDIUM | [[parsefile-double-mtime]] | Redundant mtime stat call on every file parse |

## Code Cleanup (5)

Localized fixes and naming issues.

| Priority | Issue | Scope |
|----------|-------|-------|
| LOW | [[normalize-functions-naming-confusion]] | normalizeId vs normalizeWikiLink naming unclear |
| LOW | [[filetype-extraction-naming-collision]] | ParsedMarkdown vs ParsedFile type overlap |
| LOW | [[orphaned-embeddings-table-in-cache]] | Cache creates embeddings table that may be unused |
| LOW | [[graphcore-approaching-threshold]] | GraphCore at ~305 lines, monitor |
| LOW | [[type-guard-pattern-could-be-generic]] | isNode/isVectorIndex follow identical pattern |

## Design Decisions (2)

Behavior that needs a decision, not code.

| Priority | Issue | Scope |
|----------|-------|-------|
| MEDIUM | [[Parser Edge Cases]] | Nested code blocks, escaped brackets, frontmatter injection |
| LOW | [[List Nodes Tag Filter Limitation]] | Tag filter only searches tags array, not custom properties |

## Strategy (1)

Deferred or cross-cutting concerns.

| Priority | Issue | Scope |
|----------|-------|-------|
| DEFERRED | [[E2E Testing]] | End-to-end test strategy, post-MVP |
