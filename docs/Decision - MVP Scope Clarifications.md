# Decision - MVP Scope Clarifications

**Status:** Decided
**Affects:** [[MVP]], [[DocStore]]

## Problem

Several scope items are mentioned in different docs with conflicting or unclear status:

1. **Subdirectories**: MVP says "single directory" but examples show paths like `notes/research.md`
2. **Inline tags**: DocStore says "YAML array only" but also mentions inline `#tag` as "future"
3. **Alias support**: Wiki-links mentions frontmatter aliases but MVP doesn't address
4. **Non-markdown formats**: DocStore lists txt, html, rtf but MVP says "markdown only"

Need explicit in/out for MVP.

## Items to Clarify

### 1. Subdirectory Support

**Question:** Does "single directory" mean flat (no subdirs) or single root with subdirs?

**Current docs say:**
- MVP: "Single directory (no federation)"
- ID examples: `notes/research.md` (implies subdirs)
- DocStore: "Scan directory for supported files" (recursive?)

**Options:**
- A: Flat only. Files in root directory. Subdirs ignored.
- B: Single root, recursive scan. Subdirs become path prefixes. ✓ SELECTED
- C: Configurable depth limit.

**Decision:** Option B. DocStore works with any arbitrary directory structure. Single root with recursive scan.

### 2. Inline Tag Syntax

**Question:** Are inline `#tag` markers recognized in MVP?

**Current docs say:**
- DocStore: "YAML array in frontmatter only" for MVP
- DocStore: "Future: Inline #tag syntax (Obsidian-compatible). Not MVP."

**Options:**
- A: Frontmatter only. `#tag` in content is just text. ✓ SELECTED
- B: Both frontmatter and inline. Merged into tags array.

**Decision:** Option A. Deferred, not MVP. Frontmatter YAML only.

### 3. Alias Support

**Question:** Can `[[ML]]` resolve to a note with `aliases: [ML]` in frontmatter?

**Current docs say:**
- Wiki-links: Mentions aliases as possible
- Node Identity: Lists as "Future (Not MVP)"

**Options:**
- A: No alias support. Links must match filename/ID. ✓ SELECTED
- B: Parse `aliases` frontmatter, use for resolution.

**Decision:** Option A. Not MVP. Links resolve by filename/ID only. Note: `[[link|display text]]` pipe syntax for display is unaffected—that's presentation, not resolution.

### 4. Non-Markdown Formats

**Question:** Are .txt, .html, .rtf files parsed in MVP?

**Current docs say:**
- DocStore: Lists all four formats with parsers
- MVP scope: "markdown files with SQLite cache, no html or other doc types"

**Options:**
- A: Markdown only (.md files) ✓ SELECTED
- B: All text formats (md, txt, html, rtf)

**Decision:** Option A. Markdown only for MVP. Already established in [[MVP]] scope.

### 5. Heading/Block Links

**Question:** Do `[[Note#Heading]]` and `[[Note#^blockid]]` resolve?

**Current docs say:**
- Wiki-links: Shows syntax, says "future"
- Node Identity: Lists as "Future (Not MVP)"

**Options:**
- A: Ignore fragments. `[[Note#Heading]]` → link to `Note`, ignore `#Heading`. ✓ SELECTED
- B: Error on fragment syntax.
- C: Full fragment support.

**Decision:** Option A. Strip fragments silently. `[[Note#Heading]]` and `[[Note#^blockid]]` resolve to `Note`.

### 6. Default Hub Metric

**Observation from review:** PageRank is expensive. Should `in_degree` be default?

**Current docs say:**
- MCP Server: `get_hubs` defaults to `"pagerank"`
- StoreProvider: Supports `pagerank | in_degree | out_degree`

**Options:**
- A: Keep PageRank default (most "interesting" results)
- B: Default to in_degree (fast, still useful) ✓ SELECTED
- C: No default, require explicit metric

**Decision:** Option B. Default to `in_degree`. Fast O(1) lookup vs O(n) PageRank computation. PageRank remains available as explicit option.

## Summary Table

| Item | In MVP? | Decision |
|------|---------|----------|
| Subdirectories | Yes | Single root, recursive scan |
| Inline #tags | No | Deferred. Frontmatter YAML only |
| Aliases | No | Not MVP. Links resolve by filename/ID |
| txt/html/rtf | No | Markdown only |
| Fragment links | Partial | Strip silently, link resolves to note |
| Default hub metric | Changed | `in_degree` (was `pagerank`) |

## Questions to Resolve

1. ~~Confirm subdirectory interpretation~~ Yes, recursive scan
2. ~~Confirm markdown-only for MVP~~ Already decided
3. ~~Confirm stripping fragments vs error~~ Strip silently
4. ~~Confirm changing default hub metric~~ in_degree

## Decision

All six items decided. See individual sections above for rationale.

## Outcome

Decided. MVP scope is now unambiguous on these items. Related docs ([[MCP Server]], [[DocStore]], [[Wiki-links]]) should be updated to reflect these decisions.

## Related

- [[Decisions]] — Decision hub
- [[MVP]] — Scope definition
- [[DocStore]] — Implementation details
- [[Wiki-links]] — Link syntax
