# Changelog

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
