# Wiki-links

Link syntax for edges. The primary way to create relationships in [[DocStore]].

## Syntax

```markdown
Link to [[Another Note]]
Link with alias [[Another Note|display text]]
Link to heading [[Another Note#Section]]
```

## How They Become Edges

When [[DocStore]] parses a file:

1. **Scan content** for `[[...]]` patterns
2. **Extract target** (the text inside brackets)
3. **Resolve target** to a node ID
4. **Create edge** from current node to target

```
File: concepts/ml.md
Content: "See also [[neural networks]] and [[deep learning]]"

Result:
  ml → neural-networks (edge)
  ml → deep-learning (edge)
```

## Resolution Rules

See [[Decision - Node Identity]] for full rationale.

Target text resolves to a Node ID following Obsidian-compatible rules:

**Case-insensitive matching:**
- `[[Neural Networks]]` matches `neural-networks.md`, `Neural Networks.md`

**Path-qualified links:**
- `[[concepts/neural-networks]]` → matches `concepts/neural-networks.md` specifically
- `[[neural-networks]]` (no path) → searches entire store

**Resolution at write time:**
- When ambiguity exists (multiple matches), resolve and store minimum path needed
- `[[meeting]]` with `notes/meeting.md` and `archive/meeting.md` → user picks, stored as `[[notes/meeting]]`

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

Some systems support aliases:
```yaml
---
aliases: [ML, machine-learning]
---
```

Then `[[ML]]` resolves to this note. DocStore can support this via frontmatter parsing.

## Related

- [[DocStore]] — Uses wiki-links for edge extraction
- [[Graph Projection]] — Wiki-links enable projection
- [[Node]] — Links become `outgoingLinks` array
