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
- **No flaky tests.** A test that sometimes passes and sometimes fails is a broken test. Fix the test or fix the code — never ignore it.
- **Never loosen tests to make code pass.** If a test fails, fix the code or fix a genuinely broken test. Increasing timeouts, widening thresholds, or adding retries to hide flakiness is an anti-pattern. If acceptance criteria need adjustment due to real limitations, that's a deliberate product decision — not a testing hack.

See [[TDD]] for full methodology and tooling.

**Docs stay in sync with code.**

When changing behavior, update all relevant documentation in the same change:
- MCP tool schemas (`src/mcp/server.ts` TOOL_SCHEMAS) — LLMs only see these descriptions
- Type definitions and JSDoc comments
- Architecture docs in `docs/` if the change affects documented behavior
- README if user-facing behavior changes

## Design Principles

**Graceful degradation. Always.**

- Features that fail should degrade, not crash
- Partial functionality beats total failure
- Log warnings, continue operating where possible
- User should never lose work due to recoverable errors

## Documentation

Architecture docs live in `docs/` as an Obsidian vault. `docs/GPI.md` and `docs/GraphCore.md` are the primary references.

**Use Roux MCP for all markdown operations.**

For any `.md` file in this repository, use the Roux MCP server — not direct file tools:

| Operation | Use This | Not This |
|-----------|----------|----------|
| Search docs | `mcp__roux__search` | Grep |
| Read a doc | `mcp__roux__get_node` | Read |
| Create a doc | `mcp__roux__create_node` | Write |
| Update a doc | `mcp__roux__update_node` | Edit |
| Find related docs | `mcp__roux__get_neighbors` | Grep/Glob |

Why: Roux is a GPI. If we're not using it for our own docs, we're not eating our own dogfood. The MCP layer handles frontmatter, wikilinks, and graph consistency. Direct file writes bypass that.

Exception: Code files (`.ts`, `.js`, etc.) use direct file tools as normal.

**Usage docs strategy:**
- Detailed usage examples go in component-specific docs (e.g., `docs/DocStore.md#Usage`)
- `CONTRIBUTING.md` has a "Component Usage" table with high-level descriptions + wikilinks to detailed sections
- After each phase, update both: add `## Usage` to component doc, add row to CONTRIBUTING table

**Tracking directories:**
- `docs/roadmap/` — Future features, post-MVP enhancements, deferred scope
- `docs/issues/` — Current bugs, test gaps, tech debt that should be fixed
- `docs/issues/archive/` — Resolved issues (never delete, always archive)

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
