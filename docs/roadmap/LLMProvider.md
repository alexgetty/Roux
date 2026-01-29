---
type: Feature
status: Planned
priority: P1
effort: L
phase: Post-MVP
category: Storage & Providers
---

# Feature - LLMProvider

LLM-assisted features for content generation and analysis.

## Summary

Add LLMProvider interface to enable AI-powered operations on graph content.

## Scope

- Summarize node content
- Suggest tags based on content
- Generate related content suggestions
- Answer questions using graph context

## Dependencies

- [[EmbeddingProvider]] (for context retrieval)
- [[GraphCore]] (for orchestration)

## MCP Tools (Phase 0.5)

From [[MCP Server#Future Tools]]:
- `summarize` - Generate summary of node
- `suggest_tags` - AI-generated tag suggestions
- `answer` - RAG-style Q&A over graph

## References

- [[LLMProvider]] — Interface specification
- [[MCP Server#Future Tools]] — Tool definitions
- [[MVP#Out of Scope]] — Scoping decision
