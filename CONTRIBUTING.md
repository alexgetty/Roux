# Contributing to Roux

## Development Setup

```bash
npm install
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm test` | Run all tests |
| `npm test -- --reporter=verbose` | Show each test name |
| `npm test -- path/to/file.test.ts` | Run specific test file |
| `npm run test:watch` | Re-run tests on file changes |
| `npm run test:coverage` | Run with 100% coverage enforcement |
| `npm run typecheck` | Type check without building |
| `npm run build` | Build to `dist/` |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix auto-fixable lint issues |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting without changes |

## TDD Workflow

**Red → Green → Refactor. No exceptions.**

1. Write a failing test that defines expected behavior
2. Write minimum code to make the test pass
3. Refactor while keeping tests green

See `docs/TDD.md` for full methodology.

## Test Organization

```
tests/
├── unit/           # Isolated function/method tests
├── integration/    # Component interaction tests
└── contracts/      # Provider interface compliance tests
```

## Coverage

100% coverage required. Build fails otherwise.

Files excluded from coverage:
- `src/**/*.d.ts` - Type declarations (no runtime code)

## Directory Structure

```
src/
├── types/          # Interfaces and type guards
├── cli/            # CLI commands
├── core/           # GraphCore orchestration
├── graph/          # GraphManager + graphology integration
├── mcp/            # MCP server and tools
├── providers/      # Store, Embedding, Vector implementations
│   ├── docstore/   # DocStore (file-based Store)
│   ├── embedding/  # TransformersEmbedding
│   ├── store/      # StoreProvider abstract class
│   └── vector/     # SqliteVectorIndex
└── utils/          # Shared utilities (heap, math)
```

## Component Usage

High-level pointers to detailed docs.

| Component | What it does | Docs |
|-----------|--------------|------|
| Store interface | Contract for all storage backends | [[StoreProvider]] |
| StoreProvider | Abstract class with shared store logic (graph, vector, batch) | [[StoreProvider]] |
| DocStore | File-based Store with SQLite cache | [[DocStore]] |
| GraphManager | Graph construction, traversal, centrality | [[GraphCore]] |
| VectorIndex | Pluggable vector storage and similarity search | [[VectorProvider]] |
| Embedding | Stateless vector generation | [[EmbeddingProvider]] |
| TransformersEmbedding | Local ONNX embedding (default) | [[Transformers]] |
| MCP Server | Model Context Protocol interface | [[MCP Server]] |
| CLI | `roux init`, `roux serve`, `roux sync` | [[Config]] |
