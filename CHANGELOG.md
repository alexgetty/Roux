---
id: MKFTHic4umOg
---
# Changelog

## 0.2.0

### Features
- Stable frontmatter IDs: nodes now persist identity across renames and moves
- FormatReader plugin architecture for extensible file format support
- Add rawLinks field to ParsedMarkdown interface
- Model mismatch detection warns when vector index was built with different embedding model
- Naming conventions config for customizable file creation patterns

### Architecture
- Extract GraphManager for cleaner separation of graph operations
- Extract StoreProvider abstract class for shared store logic
- Modularize MCP handlers with centralized validation
- Three-tier provider naming convention across all providers
- Optimize neighbor traversal with iterator-based early termination

### Fixes
- Fix FileWatcher debounce timer leak and 4 related issues
- Fix type guard validation gaps
- Resolve 9 test audit issues and 5 misc bugs
- Fix ID normalization edge cases

### Quality
- Achieve 100% code coverage
- Add edge case tests for zero vectors, truncation, and invalid UTF-8

## 0.1.3
- Redesign create_node API: id-first, title optional (derived from filename)
- Clarify quick start docs: roux init auto-starts server in Claude Code

## 0.1.2
- Add release scripts (patch/minor/major)
- Remove self-referential dependency

## 0.1.1
- Refactor documentation: clarify GPI vision, simplify README
- Redesign plugin system: namespace-based composition, additive schemas
- Remove pagerank from MVP metrics
- Extract MCP response helpers, expand test coverage
- Add markdown file protection hooks
- Metadata-only responses for search/neighbors
- Fix MCP handler validation and pagination bugs
- Implement batch node operations (listNodes, resolveNodes, nodesExist)
- Fix EMFILE watcher crash with graceful degradation
- Implement wiki-link resolution for nested vaults
- Initial release: CLI, MCP server, DocStore, file watcher, vector search
