# CLAUDE.md

## What is Roux

A **Graph Programming Interface (GPI)** - a consistent interface for graph-structured knowledge. Semantic search, traversal, CRUD, and AI co-authoring through a unified API regardless of storage backend.

## Architecture

GraphCore is the orchestration hub with zero functionality itself - delegates to pluggable Providers (Store, Embedding, LLM, etc.). StoreProvider is required; others optional and dynamically expose capabilities.

## Development Process

**Strict TDD. No exceptions.**

- Never write implementation code without a failing test first
- Red → Green → Refactor. Always.
- Tests define the contract before code fulfills it
- 100% coverage required. No untested code ships.

See [[TDD]] for full methodology and tooling.

## Documentation

Architecture docs live in `docs/` as an Obsidian vault. `docs/GPI.md` and `docs/GraphCore.md` are the primary references.

**Usage docs strategy:**
- Detailed usage examples go in component-specific docs (e.g., `docs/DocStore.md#Usage`)
- `CONTRIBUTING.md` has a "Component Usage" table with high-level descriptions + wikilinks to detailed sections
- After each phase, update both: add `## Usage` to component doc, add row to CONTRIBUTING table

**Tracking directories:**
- `docs/roadmap/` — Future features, post-MVP enhancements, deferred scope
- `docs/issues/` — Current bugs, test gaps, tech debt that should be fixed

## Code Style

**Comments:** Only when adding information invisible to the code itself.
- Defaults, constraints, hidden behaviors, "relative to what" → comment
- Restating the type/function name → delete it

```typescript
// Bad: comment just restates the name
/** Cache configuration. */
export interface CacheConfig { ... }

// Good: comment adds non-obvious context
export interface CacheConfig {
  /** SQLite directory */
  path: string;
}
