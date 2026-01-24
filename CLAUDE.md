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
