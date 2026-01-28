---
title: test-audit-2025-01-index
tags:
  - index
  - test-audit
  - critical
  - hub
---
# Test Audit Index (January 2025)

## Status: Pending Green Team

Red team audit of all 37 test files completed. Findings consolidated into 9 root cause issues. Ready for systematic remediation.

---

## Consolidated Issues (Fix These)

### CRITICAL

| Issue | Files | Problem |
|-------|-------|---------|
| [[consolidated-type-guard-validation-gaps]] | 4 | Runtime guards pass invalid data - `isNode` ignores `sourceRef`, `properties: []` passes, array elements unchecked |

### HIGH

| Issue | Files | Problem |
|-------|-------|---------|
| [[consolidated-boundary-conditions]] | 13 | Zero, one, MAX_SAFE_INTEGER untested across validators |
| [[consolidated-error-propagation-gaps]] | 8 | Promise.all swallows partial failures silently |
| [[consolidated-graph-topology-coverage]] | 4 | Self-loops, cycles, disconnected components untested |
| [[consolidated-unicode-i18n-handling]] | 6 | toLowerCase() locale issues, multi-byte slice hazards |

### MEDIUM

| Issue | Files | Problem |
|-------|-------|---------|
| [[consolidated-weak-assertions]] | 11 | Existence checks instead of behavioral verification |
| [[consolidated-empty-string-validation]] | 9 | Empty/whitespace inputs untested |
| [[consolidated-mock-quality]] | 7 | Mocks drift from real interfaces |
| [[consolidated-timing-based-flakiness]] | 3 | Wall-clock dependencies cause intermittent failures |

---

## Individual Audit Files

All original audits are preserved with cross-references to their consolidated issues.

### Types & Utils
- [[audit-types-node-test]] - CRITICAL: type guard gaps
- [[audit-types-provider-test]] - HIGH: StoreProvider unguarded
- [[audit-utils-math-test]] - HIGH: dimension mismatch, empty vectors
- [[audit-utils-heap-test]] - MEDIUM: duplicate values, comparator edge cases

### DocStore
- [[audit-docstore-parser-test]] - HIGH: malformed YAML, escaped brackets
- [[audit-docstore-links-test]] - HIGH: unicode, case sensitivity
- [[audit-docstore-cache-test]] - HIGH: zero coverage on getStats, updateOutgoingLinks
- [[audit-cache-embeddings-test]] - MEDIUM: NaN/Infinity, foreign key
- [[audit-cache-centrality-test]] - HIGH: incomplete upsert, foreign key
- [[audit-cache-resolve-test]] - MEDIUM: threshold boundary, exact match
- [[audit-readers-markdown-test]] - MEDIUM: code blocks, deduplication
- [[audit-reader-registry-test]] - HIGH: empty extensions, dot normalization
- [[audit-file-operations-test]] - CRITICAL: path traversal untested
- [[audit-file-watcher-test]] - HIGH: silent mock failures, useless tests
- [[audit-docstore-watcher-test]] - HIGH: stale cache on parse failure
- [[audit-docstore-test]] - HIGH: hasEmbedding zero coverage

### Graph
- [[audit-graph-builder-test]] - MEDIUM: case sensitivity mismatch
- [[audit-graph-traversal-test]] - HIGH: self-loops, tie-breaking
- [[audit-graph-analysis-test]] - MEDIUM: single topology tested
- [[audit-graph-manager-test]] - HIGH: rebuild behavior unknown
- [[audit-graph-index-test]] - LOW: existence-only checks

### Embedding & Vector
- [[audit-embedding-transformers-test]] - CRITICAL: interface compliance is compile-time only
- [[audit-vector-sqlite-test]] - HIGH: race-dependent test, O(n) memory

### Core
- [[audit-core-graphcore-test]] - HIGH: depth > 1 undocumented
- [[audit-graphcore-integration-test]] - HIGH: listNodes/resolveNodes zero integration

### MCP
- [[audit-mcp-truncate-test]] - HIGH: unicode slice, content not verified
- [[audit-mcp-types-test]] - HIGH: malformed test objects
- [[audit-mcp-transforms-test]] - HIGH: error propagation untested
- [[audit-mcp-handlers-test]] - HIGH: array element types unchecked
- [[audit-mcp-server-test]] - HIGH: mock sabotages nodesExist
- [[audit-mcp-handlers-integration-test]] - HIGH: resolveNodes missing

### CLI
- [[audit-cli-init-test]] - HIGH: YAML parsing fragile
- [[audit-cli-serve-test]] - CRITICAL: embedding failure crashes server
- [[audit-cli-status-test]] - HIGH: chain blindness
- [[audit-cli-viz-test]] - HIGH: XSS untested, empty graph

### Integration
- [[audit-watcher-file-events-test]] - HIGH: timing bounds too loose

### Barrel Exports
- [[audit-index-test]] - CRITICAL: entire public API untested

---

## Notes

- Parser audit had contamination from concurrent plugin work - cleaned up, CRITICAL removed
- `duplicate-event-coalescing-untested.md` can be archived - tests now exist
- Security gaps flagged: path traversal, XSS in viz, array type holes

## Next Steps

1. Fix CRITICAL type guard issues first - they violate type contracts
2. Work through HIGH issues by consolidated root cause
3. MEDIUM issues can be addressed incrementally
