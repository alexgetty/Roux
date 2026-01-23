# DocStore

File-based [[StoreProvider]] implementation. Graph projected from linked documents. MVP storage backend.

## Overview

DocStore treats a directory of text files as a graph. Documents become [[Node|Nodes]], [[Wiki-links]] become edges. The files themselves are the source of truth—no data lock-in, human-editable, works with Obsidian.

## How It Works

```
┌──────────────────┐      ┌──────────────────┐
│   Markdown       │      │   DocStore       │
│   Directory      │ ───► │   (Graph         │
│   with           │      │   Projection)    │
│   [[wiki-links]] │      │                  │
└──────────────────┘      └────────┬─────────┘
                                   │
                          ┌────────▼─────────┐
                          │   SQLite Cache   │
                          │   - Embeddings   │
                          │   - Centrality   │
                          │   - Search index │
                          └──────────────────┘
```

**Source of truth**: The files
**Cache**: SQLite for derived data (embeddings, centrality scores, search index)

## Graph Projection

1. **Scan directory** for supported files
2. **Parse each file** → extract frontmatter, content, links
3. **Generate Node ID** → see ID Generation below
4. **Create Node** for each file
5. **Extract edges** from [[Wiki-links|wiki-links]] and other link syntaxes
6. **Build graph** using graphology
7. **Generate embeddings** via [[EmbeddingProvider]]
8. **Compute centrality** (PageRank, degree)
9. **Cache everything** in SQLite

## ID Generation

See [[Decision - ID Format]] for full rationale.

**MVP:** Node ID derived from relative file path, lowercased, with extension.
- `Notes/Research.md` → `notes/research.md`
- Case-insensitive matching (Obsidian-compatible)

**Future:** Frontmatter `id` field takes precedence over filename (for multi-format support).
```yaml
---
id: original-neo4j-id
title: Research Notes
---
```
This enables migration support: IDs from other stores can be preserved in frontmatter.

## Supported Formats

**MVP:** Markdown only (`.md`) with YAML frontmatter.

**Future:**
- Plain text (`.txt`)
- HTML (`.html`, `.htm`)
- RTF (`.rtf`)

Each format has a parser. Parsers extract:
- Title (filename, H1, or frontmatter)
- Content (full text)
- Tags (see Tag Format below)
- Links (wiki-links, HTML links, etc.)

## Tag Format

**MVP:** YAML array in frontmatter only.

```yaml
---
title: My Note
tags: [machine-learning, research]
---
```

Or multi-line:
```yaml
---
tags:
  - machine-learning
  - research
---
```

**Matching:** Case-insensitive. `Machine-Learning` matches `machine-learning`.

**Future:** Inline `#tag` syntax (Obsidian-compatible). Not MVP.

## File Watching

DocStore monitors the directory while serving. See [[Decision - Graphology Lifecycle]].

**Sync process (debounced):**
1. File change detected → queued
2. After 100ms debounce, process queue:
   - Update SQLite cache
   - Update graphology graph (nodes + edges)
   - Recompute centrality
3. Done. Everything fresh.

**Events handled:**
- File changed → re-parse, update node
- File deleted → remove from cache and graph
- New file → parse and add

Target latency: <1 second for changes to reflect in queries (debounce + sync).

## Write Operations

When [[MCP Server]] calls `create_node` or `update_node`:
1. Write/update the file on disk
2. Update cache immediately
3. No delay—writes are instantly queryable

## Vector Search

DocStore implements `searchByVector()` (part of [[StoreProvider]] interface) using its SQLite cache.

**MVP:** Brute-force cosine similarity. Load vectors from SQLite, compute similarity in application code, return top results. O(n) per query, but fast enough for hundreds to low thousands of nodes.

**Future:** sqlite-vec extension for native vector operations. Scales to 100K+ vectors with proper indexing.

See [[Decision - Vector Storage]] for the full rationale on vector search architecture.

## Design Decisions

**Parser Architecture:** Chain of parsers. File type detection routes to format-specific parser. Start with markdown only—other formats added as needed. No complex multi-format parsers.

**Link Resolution:** Match Obsidian behavior. Full path used as ID when disambiguation is needed. Error on true duplicates (same full path after Obsidian's disambiguation) for manual resolution.

**Vector Search:** Brute-force for MVP. The interface (`searchByVector()`) allows swapping to sqlite-vec later without changing callers. See [[Decision - Vector Storage]].

## Open Questions (Deferred)

- **Frontmatter Schema**: Don't enforce for MVP. Bag of properties.
- **Binary File Handling**: Ignore for MVP.
- **Symlinks**: Ignore for MVP. Document as non-goal.

## Configuration

See [[Config]] for full schema. DocStore uses `source.path`, `source.include`, `source.exclude`, and `cache.path`.

## Related

- [[StoreProvider]] — Interface DocStore implements
- [[Node]] — What DocStore produces
- [[Wiki-links]] — How edges are extracted
- [[Graph Projection]] — The transformation concept
- [[EmbeddingProvider]] — Generates vectors for semantic search
- [[Decision - SQLite Schema]] — Cache schema (hybrid: nodes, embeddings, centrality tables)
- [[Decision - Vector Storage]] — Vector search architecture
- [[Decision - Graphology Lifecycle]] — Graph construction, file sync, centrality timing
- [[Decision - Error Output]] — Warning handling during file sync
