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

## Decision

**Obsidian-compatible for MVP.** Match their behavior. Improvements later.

## Outcome

### Core Principle: Store-Native IDs

See [[Decision - ID Format]] for full rationale.

Each StoreProvider uses IDs optimized for its context. Migrations are transformation jobs that include ID translation. There is no requirement for cross-store ID portability.

### ID Resolution Order

1. Explicit ID in file (frontmatter `id:` for markdown, meta tag for HTML) — **Future, not MVP**
2. Fallback: derived from file path, lowercased, with extension — **MVP**

### MVP Rules

| Rule | Decision |
|------|----------|
| **ID generation** | Derived from filename. `Notes/Research.md` → `notes/research.md` |
| **Frontmatter ID** | Not parsed in MVP. Future: takes precedence over filename (for multi-format support). |
| **Case sensitivity** | Case-insensitive matching. `[[Note]]` matches `note.md`. |
| **Extension** | ID includes extension. `notes/research.md` not `notes/research`. |
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
| **Frontmatter ID parsing** | Read `id` field, use as canonical ID instead of filename-derived. Enables multi-format support. |
| **Migration tooling** | Transform IDs between stores, rewrite links. |
| Non-markdown formats | HTML, txt, rtf support. Extension distinguishes formats. |
| Cross-format linking | `[[page.html]]` from markdown. Unified resolution. |
| Alias resolution | Match via frontmatter `aliases` field. |
| Separator normalization | `[[Research Notes]]` matches `research-notes.md`. |
| Interactive disambiguation | Prompt user when ambiguity arises, store resolved path. |
| Fragment references | `#heading` and `#^blockid` resolution. |

### Rationale

MVP targets Obsidian users with existing markdown vaults. Matching Obsidian's linking behavior exactly means zero friction — their existing links just work.

## Related

- [[Decision - ID Format]] — ID portability and DocStore format decisions
- [[Decisions]] — Decision hub
- [[Node]] — Data model
- [[Wiki-links]] — Link syntax
- [[DocStore]] — MVP implementation
- [[Graph Projection]] — Where IDs get created
