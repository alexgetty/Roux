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

Each store implementation defines its own projection rules. See specific store docs:
- [[DocStore]] — Files to nodes, wiki-links to edges

## Link Syntaxes

Different sources use different link formats:

| Format | Syntax | Source |
|--------|--------|--------|
| Wiki-link | `[[target]]` | Obsidian, wikis |
| Markdown | `[text](target.md)` | Standard markdown |
| HTML | `<a href="target">` | HTML documents |

Store implementations may support multiple parsers.

## Challenges

**Ambiguous references**
- `[[Note]]` could match `note.md`, `Note.md`, `notes/note.md`
- Resolution: Obsidian-compatible case-insensitive matching. On ambiguity, resolve at write time and store qualified path. See [[decisions/Node Identity]].

**Missing targets**
- Link to `[[Nonexistent]]` → broken edge
- MVP: Log warning, skip edge creation

**Circular references**
- A links to B links to A
- Fine for graph, but affects traversal algorithms

## When Projection Happens

Projection timing depends on the store implementation. For file-based stores like [[DocStore]], projection happens on server startup and incrementally on file changes.

## Related

- [[DocStore]] — Primary user of graph projection
- [[Wiki-links]] — Primary link syntax
- [[Node]] — What projection produces
- [[StoreProvider]] — Receives projected graphs
