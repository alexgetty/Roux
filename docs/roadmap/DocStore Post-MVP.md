---
title: Docstore Post Mvp
tags:
  - roadmap
type: Enhancement
status: Proposed
priority: P2
effort: M
phase: Post-MVP
category: Storage & Providers
---
# DocStore Post-MVP

Items identified during red team audit. Valid concerns but out of scope for MVP (<200 nodes, single-user Obsidian vault).

## Concurrency

### Concurrent createNode on same ID
Two parallel `createNode` calls for same ID could race. SQLite handles atomicity, but explicit test coverage would document the behavior. Single-user MVP makes this unlikely.

### Transaction wrapping for createNode
File write + cache upsert + graph rebuild are separate operations. If cache upsert fails after file write, orphan file results. Filesystem + SQLite aren't transactional together.

## Scale

### Massive content handling (100KB+ markdown)
No test for large files. MVP targets typical Obsidian note sizes. Large file handling (streaming, chunking) is post-MVP.

### 10K+ nodes performance
No performance test at scale. `listNodes` uses `LIMIT 1000` max, pagination handles larger sets. MVP targets <200 nodes.

## Edge Cases

### Symlink loops
Chokidar uses `followSymlinks: false` but symlinks inside sourceRoot pointing outside could still cause issues. Standard Obsidian vaults don't use symlinks.

### Nested code blocks
Triple-backticks inside triple-backticks is valid markdown. Current regex would fail. Rare in practice.

### Very long wiki links
`[[${repeat('a', 10000)}]]` would parse but might cause issues downstream. No real vault would have these.

### Unicode in tags
`searchByTags` uses `LOWER()` which handles ASCII. Unicode case folding (Turkish i, etc.) is SQLite-locale dependent. MVP uses English.

### Huge frontmatter arrays
Frontmatter containing 1000+ tags — verify memory handling. Real vaults don't do this.
