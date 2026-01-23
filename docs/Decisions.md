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
| [[Decision - Search Ownership]] | Decided | [[GraphCore]], [[StoreProvider]], [[EmbeddingProvider]] |
| [[Decision - Vector Storage]] | Decided | [[EmbeddingProvider]], [[DocStore]], [[StoreProvider]] |
| [[Decision - Node Identity]] | Decided | [[Node]], [[StoreProvider]], [[Wiki-links]] |
| [[Decision - Edge Futureproofing]] | Decided | [[Edge]], [[Node]], [[StoreProvider]] |
| [[Decision - Error Contract]] | Decided | [[GraphCore]], all providers, [[MCP Server]] |
| [[Decision - Provider Lifecycle]] | Decided | [[GraphCore]], [[MCP Server]] |
| [[Decision - Default Embeddings]] | Decided | [[EmbeddingProvider]], [[Config]], [[MVP]] |
| [[Decision - ID Format]] | Decided | [[Node]], [[Decision - Node Identity]], [[DocStore]] |
| [[Decision - SQLite Schema]] | Decided | [[DocStore]], [[StoreProvider]], [[EmbeddingProvider]] |
| [[Decision - MVP Scope Clarifications]] | Decided | [[MVP]], [[DocStore]], [[MCP Server]] |
| [[Decision - Graphology Lifecycle]] | Decided | [[DocStore]], [[GraphCore]], [[StoreProvider]] |
| [[Decision - MCP Transport]] | Decided | [[MCP Server]], [[CLI]], [[Config]] |
| [[Decision - CLI Workflow]] | Decided | [[CLI]], [[DocStore]], [[Config]] |
| [[Decision - Error Output]] | Decided | [[CLI]], [[MCP Server]], [[DocStore]] |

### Deferred (Not Blocking MVP)

| Decision | Status | Affects |
|----------|--------|---------|
| [[Decision - Performance Thresholds]] | Deferred | [[MVP]], [[DocStore]], [[StoreProvider]] |

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
