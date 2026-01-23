# Decision - ID Format

**Status:** Decided
**Affects:** [[Node]], [[Decision - Node Identity]], [[DocStore]], [[Wiki-links]]

## Part 1: ID Portability (Decided)

### Problem

The original [[Decision - Node Identity]] spec states that Node.id must "survive migration between any two stores unchanged." This assumes IDs should be portable across all StoreProvider implementations.

But this creates tension: optimizing IDs for cross-store portability may compromise each store's native performance and functionality.

### Decision

**Optimize for store-native IDs, not portability.**

- Each StoreProvider uses IDs suited to its context
- DocStore IDs are optimized for file-based operations
- Neo4j IDs (future) would use Neo4j-native conventions
- Migrations are transformation jobs that include ID translation
- Migration tooling handles the mapping (old ID → new ID, update all links)

### Rationale

- Migrations are infrequent, typically one-time events
- Most migrations go from simpler → more complex stores (prototype → production)
- Downgrade migrations are possible but less common
- Constraining all stores to a common ID format creates lowest-common-denominator limitations
- Migration with ID translation is a solved problem — databases rewrite foreign keys constantly

### Implications

- Migration tooling (future) must handle ID mapping and link rewriting
- Each StoreProvider documents its own ID format

---

## Part 2: DocStore ID Format (Decided)

### Problem

For DocStore specifically, the docs contradict each other:

Current doc quotes:
- Node Identity: "ID includes `.md`. Links can omit it"
- DocStore: "Node ID derived from relative file path, lowercased"
- MCP Server: `create_node` "Creates file at `{id}.md`" (implies ID doesn't have extension)

Need to resolve: what format do DocStore IDs take?

### Decision

**IDs include file extension.**

**MVP:** ID derived from file path, lowercased, with extension.

**Future (multi-format):** Explicit ID in file (frontmatter `id:` for markdown, meta tag for HTML) takes precedence over derived ID.

Examples:
```
MVP:
File: notes/Research.md
ID:   notes/research.md

Future (multi-format support):
File: notes/Research.md with frontmatter id: my-custom-id
ID:   my-custom-id

File: docs/API Reference.html (no meta id)
ID:   docs/api reference.html
```

### Rationale

**Extension in ID:**
- Uniqueness guaranteed by filesystem
- Multi-format support works naturally (`research.md` and `research.txt` are distinct)
- Simpler implementation: `path.toLowerCase()`
- Link resolution ambiguity (`[[note]]` matching multiple formats) exists either way

**Explicit ID precedence (future):**
- Enables migration compatibility (Neo4j → DocStore, ID preserved in frontmatter)
- Round-trip possible if needed (DocStore → Neo4j → DocStore)
- User control when needed, sensible default otherwise
- Only needed once we support multiple file formats

### Link Resolution

Wiki-links in files don't include extensions. Resolution at parse time:

```
File contains:        [[Note]]
Search for:           note.md, note.txt, note.html, etc.
Match found:          Note.md
Node.outgoingLinks:   ["note.md"]
```

File content unchanged. Resolution happens when parsing into Node.

Multi-format ambiguity (future): if `[[Note]]` matches multiple files, need resolution strategy (extension precedence, error, or require explicit `[[Note.md]]`). Not MVP — markdown only for now.

### Implications

- Link resolution logic needed at parse time

## Related

- [[Decisions]] — Decision hub
- [[Decision - Node Identity]] — Parent decision
- [[Node]] — Data model
- [[DocStore]] — Implementation
- [[MCP Server]] — create_node behavior
- [[Wiki-links]] — Link syntax and resolution
