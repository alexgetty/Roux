# Architectural Decisions

Tracking document for architectural decisions. Each is a one-way door or affects one-way door interfaces.

**Status:** All MVP-blocking decisions resolved. Ready for implementation.

## Status Legend

| Status | Meaning |
|--------|---------|
| **Open** | Needs discussion and decision |
| **Decided** | Decision made, documented |
| **Implemented** | Decision implemented in code |

## Decisions

### Decided

| Decision | Status | Affects |
|----------|--------|---------|
| [[decisions/Search Ownership]] | Decided | [[GraphCore]], [[StoreProvider]], [[EmbeddingProvider]] |
| [[decisions/Vector Storage]] | Decided | [[EmbeddingProvider]], [[DocStore]], [[StoreProvider]] |
| [[decisions/Node Identity]] | Decided | [[Node]], [[StoreProvider]], [[Wiki-links]] |
| [[decisions/Edge Futureproofing]] | Decided | [[Edge]], [[Node]], [[StoreProvider]] |
| [[decisions/Error Contract]] | Decided | [[GraphCore]], all providers, [[MCP Server]] |
| [[decisions/Provider Lifecycle]] | Decided | [[GraphCore]], [[MCP Server]] |
| [[decisions/Default Embeddings]] | Decided | [[EmbeddingProvider]], [[Config]], [[MVP]] |
| [[decisions/ID Format]] | Decided | [[Node]], [[decisions/Node Identity]], [[DocStore]] |
| [[decisions/SQLite Schema]] | Decided | [[DocStore]], [[StoreProvider]], [[EmbeddingProvider]] |
| [[decisions/MVP Scope Clarifications]] | Decided | [[MVP]], [[DocStore]], [[MCP Server]] |
| [[decisions/Graphology Lifecycle]] | Decided | [[DocStore]], [[GraphCore]], [[StoreProvider]] |
| [[decisions/MCP Transport]] | Decided | [[MCP Server]], [[CLI]], [[Config]] |
| [[decisions/CLI Workflow]] | Decided | [[CLI]], [[DocStore]], [[Config]] |
| [[decisions/Error Output]] | Decided | [[CLI]], [[MCP Server]], [[DocStore]] |

### Deferred (Not Blocking MVP)

| Decision | Status | Affects |
|----------|--------|---------|
| [[decisions/Performance Thresholds]] | Deferred | [[MVP]], [[DocStore]], [[StoreProvider]] |

## Process

1. Read the decision doc
2. Add considerations, options, tradeoffs
3. Make the call, document rationale
4. Update status here
5. Update affected interface docs

## Related

- [[implementation-plan]] — Roadmap and phases
- [[GraphCore]] — Core interfaces
- [[Node]] — Data model
