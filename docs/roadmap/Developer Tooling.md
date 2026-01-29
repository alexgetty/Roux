---
type: Feature
status: Proposed
priority: P1
effort: L
phase: Post-MVP
category: Infrastructure
---

# Developer Tooling

Debugging and DX tooling for tight feedback loops when using Roux as a dependency.

## Problem

Testing Roux in isolation is clean. Testing it while building real applications on top exposes friction:

- **Visibility:** What's in the graph? What got indexed? What didn't?
- **Debugging:** Why did this search return nothing? Is the embedding stale?
- **Iteration:** Change Roux code → rebuild → test in consumer project → repeat
- **State inspection:** Cache contents, vector store health, sync status

Without tooling, debugging becomes archaeology.

## Proposed Tools

### 1. `roux inspect` CLI

Dump graph state for debugging:

```bash
roux inspect nodes              # List all nodes with metadata
roux inspect node "Some Title"  # Full node details + embeddings
roux inspect edges              # All edges with weights
roux inspect cache              # Cache stats, last sync, dirty state
roux inspect vector             # Vector store health, dimension, count
```

### 2. `roux watch --verbose`

Live sync with detailed logging:

```bash
roux watch --verbose
# [12:34:56] File changed: notes/foo.md
# [12:34:56] Parsed: 3 links, 2 tags
# [12:34:57] Embedding generated: 384 dims
# [12:34:57] Stored: node_id=abc123
```

### 3. `roux query` REPL

Interactive graph queries without writing test code:

```bash
roux query
> search "machine learning" --limit 5
> neighbors "Some Node" --depth 2
> tags
> .exit
```

### 4. npm link workflow

Document the local development workflow:

```bash
# In roux/
npm link

# In consumer project/
npm link roux

# Changes to roux are immediately available
```

### 5. Source maps / stack traces

Ensure errors from Roux in consumer projects have useful stack traces pointing to Roux source, not compiled output.

## Development Workflow Strategy

The core tension: fast iteration on Roux vs. stability in consumer projects.

### Versioning Discipline

- **Exact version pins in consumers.** `"roux": "1.2.3"` not `"^1.2.3"`. Upgrades are deliberate.
- **Never remove, only deprecate.** Add `@deprecated` + migration path. Delete in next major.
- **Changelog discipline.** Every release documents what changed and what breaks.

### Workflow Modes

| Mode | When | How |
|------|------|-----|
| **Stable** | Building features in consumer | Consumer pins published version |
| **Development** | Debugging/improving Roux | `npm link`, expect breakage |
| **Validation** | Before publishing Roux | Run consumer tests against linked Roux |

### Consumer Project as Test Fixture

Unit tests prove Roux works in isolation. Integration tests prove it works in reality.

Maintain a small but real consumer project that exercises the API surface:
- Uses GraphCore, DocStore, MCP server
- Has its own test suite
- Lives in `tests/fixtures/consumer-app/` or separate repo

**Pre-publish validation:**

```bash
# In CI or as pre-publish hook
npm run build
cd ../consumer-project
npm link ../roux
npm test  # Consumer's tests, not Roux's
# Fails = no publish
```

This catches breakage that unit tests miss — real usage patterns, real dependency interactions.

### npm link Workflow

```bash
# In roux/
npm link

# In consumer project/
npm link roux

# Now changes to roux/dist are immediately available
# Remember to rebuild roux after changes:
npm run build  # or watch mode
```

## Priority

High for post-MVP. The feedback loop problem compounds — every hour spent debugging opaque state is an hour not building.

## References

- Real-world usage will expose gaps faster than unit tests
