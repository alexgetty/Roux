---
title: Node Identity
tags:
  - decision
  - architecture
  - identity
---
# Decision: Node Identity

**Status:** Accepted  
**Date:** 2026-01-31  
**Deciders:** Alex, Vector, Daemon, Sage

## Context

The original design used file path as node identity (`notes/foo.md` → ID `notes/foo.md`). This creates a critical problem: renaming a file changes its ID, silently breaking all incoming wikilinks.

This was flagged as P0 in the roadmap under "Link Integrity."

## Decision

**Node identity is decoupled from file path.**

Three independent concerns:

| Concern | What it is | Who controls it | Mutable? |
|---------|-----------|-----------------|----------|
| **ID** | System identity | Roux (auto-generated) | Never |
| **Title** | Human reference | User (frontmatter/h1) | Yes |
| **Path** | Storage location | User (filesystem) | Yes |

### Implementation

1. **IDs stored in frontmatter** — the file is the source of truth for DocStore
2. **Auto-generated on creation** — nanoid(12), written to frontmatter
3. **Immutable after creation** — system never changes it
4. **Wikilinks resolve by title** — user experience unchanged

```yaml
---
id: n7x2k9m4          # auto-generated, immutable
title: My Note        # user-controlled, used for wikilink resolution
type: Recipe          # schema reference (future)
---
```

### Resolution Order

Wikilinks resolve through lookup:

1. Title → ID (exact match)
2. ID → Path (current location)

File renames update the ID→Path mapping. Links don't break because they reference titles, which resolve to stable IDs.

### Duplicate Detection

If two files claim the same ID (e.g., copy-paste accident), index fails with explicit error. No silent corruption.

### Obsidian Visibility

IDs appear in Obsidian's properties panel. Users can hide with CSS:

```css
.metadata-container .metadata-property[data-property-key="id"] {
  display: none;
}
```

Documented, not our code.

## Alternatives Considered

### External ID Mapping

Store IDs in `.roux/identity.db` instead of frontmatter.

**Rejected because:**
- Adds complexity (reconciliation, drift detection)
- Two sources of truth for DocStore (file + database)
- File is already the source of truth — IDs should live there

### Path as ID (status quo)

Keep file path as identity, handle renames by scanning and updating all links.

**Rejected because:**
- Expensive for large vaults
- Modifies files user didn't touch
- Doesn't generalize to non-filesystem stores

### Alias Tracking

Maintain old→new ID mappings, resolve through alias table.

**Rejected because:**
- Complexity accumulates (stale aliases)
- Eventually consistent, not immediately consistent
- Doesn't solve the root problem

## Consequences

### Positive

- Renames don't break links
- Clear separation of concerns (ID, title, path)
- Generalizes to any StoreProvider (SQLite, API, etc.)
- File is self-contained — identity travels with content

### Negative

- ID visible in frontmatter (mitigated by CSS)
- User can manually edit ID (documented consequence)
- Copy-paste duplicates require detection

### Migration

Existing files without IDs: lazy generation on first access. ID written to frontmatter, no user action required.

## Related

- [[roadmap/Link Integrity]] — the problem this solves
- [[roadmap/Frontmatter ID]] — original roadmap item (now implemented differently)
- [[1.0 Vision - Node Schema]] — core node fields
