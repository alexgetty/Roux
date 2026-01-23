# Graph Projection

Inferring graph structure (nodes and edges) from non-graph data sources.

## Overview

Not all data is natively a graph. Markdown files, documents, even some databases don't store explicit relationships. Graph projection transforms these flat sources into graph structure.

## How It Works

```
┌─────────────────┐                    ┌─────────────────┐
│  Flat Source    │    Projection      │   Graph         │
│                 │    ─────────────►  │                 │
│  file1.md       │                    │   ○ file1       │
│  file2.md       │                    │   │             │
│  file3.md       │                    │   ├──○ file2    │
│                 │                    │   └──○ file3    │
└─────────────────┘                    └─────────────────┘
```

**Input**: Collection of documents with embedded references
**Output**: Nodes (documents) and edges (references between them)

## Projection Rules

For [[DocStore]], projection follows these rules:

1. **Node ID generation**: Derive from file path (see [[Decision - Node Identity]])
   - `Notes/Research.md` → `notes/research.md`
   - Future: frontmatter `id` field takes precedence
2. **Node creation**: Each file becomes a [[Node]]
3. **Edge extraction**: [[Wiki-links]] and other link syntaxes become edges
4. **Metadata mapping**: Frontmatter becomes node properties
5. **Content parsing**: Full text becomes node content

## Link Syntaxes

Different sources use different link formats:

| Format | Syntax | Source |
|--------|--------|--------|
| Wiki-link | `[[target]]` | Obsidian, wikis |
| Markdown | `[text](target.md)` | Standard markdown |
| HTML | `<a href="target">` | HTML documents |

[[DocStore]] supports configurable parsers for each.

## Challenges

**Ambiguous references**
- `[[Note]]` could match `note.md`, `Note.md`, `notes/note.md`
- Resolution: Obsidian-compatible case-insensitive matching. On ambiguity, resolve at write time and store qualified path. See [[Decision - Node Identity]].

**Missing targets**
- Link to `[[Nonexistent]]` → broken edge
- MVP: Log warning, skip edge creation

**Circular references**
- A links to B links to A
- Fine for graph, but affects traversal algorithms

## When Projection Happens

- `roux init`: Full projection of directory
- File change (watcher): Incremental re-projection of changed file
- `roux sync --full`: Complete rebuild

## Related

- [[DocStore]] — Primary user of graph projection
- [[Wiki-links]] — Primary link syntax
- [[Node]] — What projection produces
- [[StoreProvider]] — Receives projected graphs
