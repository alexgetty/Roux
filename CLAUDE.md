---
title: Claude
---
# CLAUDE.md

## What is Roux

A **Graph Programming Interface (GPI)** - a consistent interface for graph-structured knowledge. Semantic search, traversal, CRUD, and AI co-authoring through a unified API regardless of storage backend.

## Architecture

GraphCore is the orchestration hub with zero functionality itself - delegates to pluggable Providers (Store, Embedding, LLM, etc.). StoreProvider is required; others optional and dynamically expose capabilities.

## Development Process

**Strict TDD. No exceptions.**

> **STOP. Before you edit any file in `src/`, ask yourself:**
> 1. Have I written or modified a test in `tests/` for this change?
> 2. Did I run that test and watch it fail?
>
> If the answer to either is "no", you are violating TDD. Step back. Write the test first. This is not optional.

- Never write implementation code without a failing test first
- Red → Green → Refactor. Always.
- Tests define the contract before code fulfills it
- 100% coverage required. No untested code ships.
- **No flaky tests.** A test that sometimes passes and sometimes fails is a broken test. Fix the test or fix the code — never ignore it.
- **Never loosen tests to make code pass.** If a test fails, fix the code or fix a genuinely broken test. Increasing timeouts, widening thresholds, or adding retries to hide flakiness is an anti-pattern. If acceptance criteria need adjustment due to real limitations, that's a deliberate product decision — not a testing hack.

**TDD Workflow (mandatory):**
1. Read/understand the requirement
2. Write a failing test that asserts the expected behavior
3. Run the test — confirm it fails (red)
4. Write the minimum implementation to pass the test
5. Run the test — confirm it passes (green)
6. Refactor if needed, keeping tests green

See [[TDD]] for full methodology and tooling.

## Agent Spawning

**MANDATORY: Pass `docs/Agent Context.md` contents to every spawned agent.**

Agents spawned via Task tool do NOT automatically inherit CLAUDE.md context. When spawning any agent:

1. Read `docs/Agent Context.md`
2. Include its contents verbatim in the task prompt
3. Add task-specific requirements after the context

This ensures agents follow TDD, coverage requirements, and style guidelines. Failure to include context results in agents cutting corners (e.g., testing 3 of 16 methods instead of all 16).

**Docs stay in sync with code.**

When changing behavior, update all relevant documentation in the same change:
- MCP tool schemas (`src/mcp/server.ts` TOOL_SCHEMAS) — LLMs only see these descriptions
- Type definitions and JSDoc comments
- Architecture docs in `docs/` if the change affects documented behavior
- README if user-facing behavior changes

## Design Principles

**Single source of truth. Always.**

Every type, constant, and interface has exactly one canonical definition. Never re-export types from convenience locations—import from the source. If you need a type, trace it to where it's defined and import from there.

- Types live in `types/` — import from there, not from modules that happen to re-export them
- Constants live in one place — if two modules need the same constant, extract to a shared location
- When you see a re-export, ask: "Why doesn't the consumer import directly from the source?"

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
