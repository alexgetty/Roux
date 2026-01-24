# Wiki-links

Link syntax for edges. The primary way to create relationships in [[DocStore]].

## Syntax

```markdown
Link to [[Another Note]]
Link with display text [[Another Note|display text]]
Link to heading [[Another Note#Section]]
Link to block [[Another Note#^blockid]]
```

**MVP behavior:**
- `[[Note]]` — resolves to Note
- `[[Note|text]]` — resolves to Note, displays as "text"
- `[[Note#Heading]]` — fragment stripped, resolves to Note
- `[[Note#^blockid]]` — fragment stripped, resolves to Note

Fragment support (heading/block links) is deferred. See [[decisions/MVP Scope Clarifications]].

## How They Become Edges

Wiki-links are parsed into edges by the store implementation. See [[DocStore]] for parsing details.

The link target becomes an edge to that node's ID. Resolution rules below.

## Resolution Rules

See [[decisions/Node Identity]] for full rationale.

Target text resolves to a Node ID following Obsidian-compatible rules:

**Case-insensitive matching:**
- `[[Neural Networks]]` matches `Neural Networks.md` → ID: `neural networks.md`

**Path-qualified links:**
- `[[concepts/neural networks]]` → matches `concepts/neural networks.md` specifically
- `[[neural networks]]` (no path) → searches entire store

**Resolution at write time:**
- When ambiguity exists (multiple matches), resolve and store minimum path needed
- `[[Meeting]]` with `notes/Meeting.md` and `archive/Meeting.md` → user picks, stored as `[[notes/Meeting]]`

## Broken Links

When a wiki-link target doesn't exist:

**MVP behavior:** Log warning, skip edge creation. No mode configuration.

**Future options (not MVP):**
- Strict mode: Error, block operation
- Auto-create: Create placeholder node

## Bidirectional Links

Wiki-links are unidirectional by default:
- `A.md` contains `[[B]]` → edge from A to B
- To find what links TO a node, query incoming edges via [[StoreProvider]]

Obsidian shows "backlinks"—this is computed at query time, not stored.

## Aliases

**Not MVP.** See [[decisions/MVP Scope Clarifications]].

Some systems support aliases:
```yaml
---
aliases: [ML, machine-learning]
---
```

Then `[[ML]]` resolves to this note. DocStore could support this via frontmatter parsing in a future release. For MVP, links must match filename/ID directly.

## Related

- [[DocStore]] — Uses wiki-links for edge extraction
- [[Graph Projection]] — Wiki-links enable projection
- [[Node]] — Links become `outgoingLinks` array
- [[decisions/MVP Scope Clarifications]] — Fragment and alias scope decisions
