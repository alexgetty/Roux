# Decision - Node Identity

**Status:** Decided
**Affects:** [[Node]], [[StoreProvider]], [[Wiki-links]], [[DocStore]]

## Problem

`Node.id` is described as "unique identifier (slug)" but has no specification for:

- How IDs are generated
- Uniqueness scope and enforcement
- Case sensitivity
- Collision handling
- Character restrictions

This matters immediately for MVP. A file `Research Notes.md` could be referenced as:
- `[[Research Notes]]`
- `[[research notes]]`
- `[[research-notes]]`
- `research-notes` (slugified filename)
- `Research Notes` (raw filename without extension)

## Options

### Option A: Filename is ID (case-preserved)

ID = filename without extension, exactly as written.

- `Research Notes.md` → ID: `Research Notes`
- Links must match exactly: `[[Research Notes]]`

**Pros:** Simple. Predictable. What you see is what you get.
**Cons:** Case-sensitive links break easily. Spaces in IDs are awkward for APIs.

### Option B: Slugified filename

ID = filename normalized to URL-safe slug.

- `Research Notes.md` → ID: `research-notes`
- Links normalized on parse: `[[Research Notes]]` → resolves to `research-notes`

**Pros:** URL-safe. Case-insensitive matching. API-friendly.
**Cons:** Lossy—can't reconstruct original filename from ID. Multiple files could slug to same ID.

### Option C: Content-addressed (hash)

ID = hash of content or path.

**Pros:** Guaranteed unique. Immutable reference.
**Cons:** IDs are opaque. Renames break references. Poor DX.

### Option D: User-provided with fallback

ID from frontmatter `id:` field, falling back to slugified filename.

```yaml
---
id: research-notes
title: Research Notes
---
```

**Pros:** User control when needed. Reasonable defaults.
**Cons:** Two sources of truth. Must validate uniqueness.

## Sub-decisions

### Case sensitivity
- Case-sensitive: `Note` ≠ `note` (filesystem-like)
- Case-insensitive: `Note` = `note` (user-friendly)
- Case-preserving: Store original, match insensitively

### Link resolution
When `[[Some Note]]` could match multiple files:
- First match wins (by alpha, by date?)
- Fail loudly (require exact match)
- Prompt/log ambiguity

### Character restrictions
- Alphanumeric + hyphens only?
- Allow spaces? Unicode?
- What about `[[Note/Subnote]]` paths?

## Considerations

- Obsidian uses case-insensitive matching
- Most graph DBs use opaque IDs internally
- URLs work best with slugs
- Wiki-link syntax assumes human-readable IDs
- MCP tools will pass IDs as strings

## Decision

**Obsidian-compatible for MVP.** Match their behavior. Improvements later.

## Outcome

### Core Principle: ID Portability

`Node.id` is the canonical, portable identifier. It must:
- Survive migration between any two stores unchanged
- Be valid as a string property in all target stores (Neo4j, SurrealDB, etc.)
- Be the stable reference for all edges (`outgoingLinks`)

ID and filename are **decoupled**. DocStore derives ID from filename by default, but frontmatter `id` field takes precedence when present.

### ID Resolution Order

1. Frontmatter `id` field → canonical ID (if present)
2. No frontmatter ID → derive from filename (Obsidian-compatible default)

### MVP Rules

| Rule | Decision |
|------|----------|
| **ID generation** | Derived from filename. `Notes/Research.md` → `notes/research.md` |
| **Frontmatter ID** | Not parsed in MVP. Future: takes precedence over filename. |
| **Case sensitivity** | Case-insensitive matching. `[[Note]]` matches `note.md`. |
| **Extension** | ID includes `.md`. Links can omit it — `[[note]]` resolves to `note.md`. |
| **Path matching** | `[[note]]` searches whole store. `[[folder/note]]` is path-qualified. |
| **Ambiguity** | Match Obsidian: resolve at write time, store minimum path needed for disambiguation. Full path becomes ID when needed. |
| **Collision** | Error on true duplicates (same full path). Obsidian handles disambiguation via path—if we see a true collision, surface for manual resolution. |

### Wiki-link Syntax

```
[[target]]           → Link to target (extension optional for .md)
[[target|display]]   → Link with display text
[[target#heading]]   → Link to heading (future)
[[target#^blockid]]  → Link to block (future)
```

### Link Model (Internal)

```typescript
interface Link {
  target: string;      // Raw target from source document
  display?: string;    // Optional display text
  fragment?: string;   // #heading or #^block (future)
}
```

Parsers extract `Link` from source syntax. Store resolves `target` → node ID.

### Future (Not MVP)

| Feature | Notes |
|---------|-------|
| **Frontmatter ID parsing** | Read `id` field, use as canonical ID instead of filename-derived. |
| **Migration tooling** | Round-trip between stores preserving IDs via frontmatter. |
| **ID immutability enforcement** | Warn/block edits to frontmatter `id` field (orphans inbound edges). |
| Non-markdown formats | HTML, txt, rtf support. Extension required in links. |
| Cross-format linking | `[[page.html]]` from markdown. Unified resolution. |
| Alias resolution | Match via frontmatter `aliases` field. |
| Separator normalization | `[[Research Notes]]` matches `research-notes.md`. |
| Interactive disambiguation | Prompt user when ambiguity arises, store resolved path. |
| Fragment references | `#heading` and `#^blockid` resolution. |

### Migration Model (Future)

Bidirectional migration between stores preserves identity:

```
Neo4j (id: abc123, title: "Research Notes")
  ↓ export to DocStore
DocStore (file: Research Notes.md, frontmatter id: abc123)
  ↓ migrate back to Neo4j
Neo4j (id: abc123, title: "Research Notes")  ← identity preserved
```

| Store | ID Storage | Filename/Title |
|-------|------------|----------------|
| DocStore | Frontmatter `id` (or derived from filename) | Filename |
| Neo4j | `id` property | `title` property |
| SurrealDB | Record ID or `id` field | `title` field |

Native Obsidian users: no frontmatter `id` needed. Derive from filename.
Migrated data: frontmatter `id` preserves foreign identity.

### Store-Agnostic Interface

`Node.id` is the canonical business identifier defined by Roux, not by storage backends.

Each StoreProvider implementation maps canonical IDs to native storage:

| Store | Canonical ID | Internal Storage |
|-------|--------------|------------------|
| DocStore | `notes/research.md` | File path (+ frontmatter for foreign IDs) |
| Neo4j | `notes/research.md` | `id` property on node |
| SurrealDB | `notes/research.md` | Record ID or field |
| SQLiteStore | `notes/research.md` | Primary key |

Internal/native IDs (e.g., Neo4j's auto-generated numeric IDs) are implementation details, never exposed through StoreProvider interface.

### Rationale

MVP targets Obsidian users with existing markdown vaults. Matching Obsidian's linking behavior exactly means zero friction — their existing links just work.

The ID model is designed for portability: same `Node.id` works across any store, enabling migration without rewriting edges. Divergences and improvements come in later phases once core functionality is proven.

## Related

- [[Decisions]] — Decision hub
- [[Node]] — Data model
- [[Wiki-links]] — Link syntax
- [[DocStore]] — MVP implementation
- [[Graph Projection]] — Where IDs get created
