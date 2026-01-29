---
title: index
tags:
  - index
  - hub
---
# Open Issues

30 active issues across 7 categories.

## Test Audit Root Causes (9)

Systematic test gaps identified by red team audit. Work through by priority.

| Priority | Issue | Scope |
|----------|-------|-------|
| CRITICAL | [[consolidated-type-guard-validation-gaps]] | 4 files — runtime guards pass invalid data |
| HIGH | [[consolidated-boundary-conditions]] | 13 files — zero, empty, threshold edge cases |
| HIGH | [[consolidated-error-propagation-gaps]] | 8 files — async failures swallowed silently |
| HIGH | [[consolidated-graph-topology-coverage]] | 4 files — cycles, self-loops, disconnected graphs |
| HIGH | [[consolidated-unicode-i18n-handling]] | 6 files — multi-byte slice, locale-dependent case |
| HIGH | [[consolidated-empty-string-validation]] | 9 files — empty/whitespace inputs, path traversal |
| MEDIUM | [[consolidated-weak-assertions]] | 11 files — existence checks instead of value checks |
| MEDIUM | [[consolidated-mock-quality]] | 7 files — mocks drift from real interfaces |
| MEDIUM | [[consolidated-timing-based-flakiness]] | 3 files — wall-clock dependencies in tests |

## Architecture (5)

Structural improvements to reduce complexity and coupling.

- [[mcp-architecture]] — Monolith refactor: split handlers, co-locate schemas, centralize validation
- [[docstore-cache-complexity]] — Cache approaching 400 lines, SQL generation could be modularized
- [[cache-schema-operation-split]] — Schema ownership split across modules
- [[file-operations-depends-on-watcher]] — Inverted dependency via EXCLUDED_DIRS import
- [[docstore-constructor-options-object]] — Positional params susceptible to ordering bugs

## Performance (3)

- [[vector-search-loads-all-vectors]] — SEVERE: loads all vectors into memory for every search
- [[getneighbors-fetches-all-neighbor-ids]] — Fetches all neighbor IDs then slices, wastes memory on hubs
- [[parsefile-double-mtime]] — Redundant mtime stat call on every file parse

## MCP Behavior (2)

- [[mcp-response-size]] — Tools return full content, consuming 10-16k tokens per call
- [[mcp-updatenode-title-rename-mismatch]] — Schema says "renames file" but rename is blocked by link check

## Code Issues (5)

Localized fixes and cleanup.

- [[normalize-functions-naming-confusion]] — normalizeId vs normalizeWikiLink naming unclear
- [[filetype-extraction-naming-collision]] — ParsedMarkdown vs ParsedFile type overlap
- [[orphaned-embeddings-table-in-cache]] — Cache creates embeddings table that may be unused
- [[graphcore-approaching-threshold]] — GraphCore at ~305 lines, monitor
- [[type-guard-pattern-could-be-generic]] — isNode/isVectorIndex follow identical pattern (optional)

## Design & Behavior (4)

Ambiguous or undocumented behavior that needs a decision.

- [[UpdateNode Precedence]] — Unclear when both content and explicit outgoingLinks provided
- [[Parser Edge Cases]] — Nested code blocks, escaped brackets, frontmatter injection
- [[List Nodes Tag Filter Limitation]] — Tag filter only searches tags array, not custom properties
- [[issue-stale-update-overwrites]] — Agent can overwrite user changes with stale content

## Strategy (2)

Deferred or cross-cutting concerns.

- [[E2E Testing]] — End-to-end test strategy, deferred to post-MVP
- [[filewatcher-issues]] — 5 consolidated watcher bugs and test gaps
