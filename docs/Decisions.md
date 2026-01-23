# Architectural Decisions

Open decisions that must be resolved before MVP implementation. Each is a one-way door or affects one-way door interfaces.

## Status Legend

| Status | Meaning |
|--------|---------|
| **Open** | Needs discussion and decision |
| **Decided** | Decision made, documented |
| **Implemented** | Decision implemented in code |

## Decisions

| Decision | Status | Affects |
|----------|--------|---------|
| [[Decision - Search Ownership]] | Decided | [[GraphCore]], [[StoreProvider]], [[EmbeddingProvider]] |
| [[Decision - Vector Storage]] | Decided | [[EmbeddingProvider]], [[DocStore]], [[StoreProvider]] |
| [[Decision - Node Identity]] | Decided | [[Node]], [[StoreProvider]], [[Wiki-links]] |
| [[Decision - Edge Futureproofing]] | Decided | [[Edge]], [[Node]], [[StoreProvider]] |
| [[Decision - Error Contract]] | Decided | [[GraphCore]], all providers, [[MCP Server]] |
| [[Decision - Provider Lifecycle]] | Decided | [[GraphCore]], [[MCP Server]] |
| [[Decision - Default Embeddings]] | Decided | [[EmbeddingProvider]], [[Config]], [[MVP]] |

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
