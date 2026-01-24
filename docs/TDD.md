# Test-Driven Development

Roux follows strict test-driven development. No implementation code exists without a failing test that demanded it.

## Why Strict TDD for This Project

Roux is built primarily through agentic coding. Agents write plausible code that *looks* correct but introduces entropy over time—untested paths, edge cases that "should work," defensive code that may or may not do anything.

Strict TDD inverts this. The test defines the contract *before* the agent writes implementation. 100% coverage means nothing sneaks past. Every line of code exists because a test demanded it.

## The Rule

**Red → Green → Refactor.** No shortcuts.

1. **Red**: Write a failing test that defines expected behavior
2. **Green**: Write the minimum code to make the test pass
3. **Refactor**: Clean up while keeping tests green

If there's no failing test, there's no reason to write code.

## Why This Matters

- Tests document intent before implementation obscures it
- Forces interface design before implementation details
- Catches scope creep—if it's not tested, it's not needed
- Makes refactoring safe
- Prevents "I'll add tests later" (you won't)

## Workflow

### Before Writing Any Code

1. Identify the behavior to implement
2. Write a test that exercises that behavior
3. Run the test—confirm it fails
4. Only then write implementation

### During Implementation

- Write only enough code to pass the current failing test
- Resist the urge to "finish" the implementation
- Each new behavior requires a new failing test first

### After Tests Pass

- Refactor if needed (tests stay green)
- No new functionality during refactor
- Commit when green

## Test Scope

### Unit Tests
- Test single functions/methods in isolation
- Mock dependencies
- Fast, deterministic

### Integration Tests
- Test component interactions
- Real dependencies where practical
- Provider implementations get integration tests

### Contract Tests
- Verify provider implementations against interfaces
- Any [[StoreProvider]] implementation must pass the same contract tests
- Ensures interchangeability

## What Gets Tested

Everything that has behavior:

- [[GraphCore]] orchestration logic
- Provider implementations ([[DocStore]], [[Transformers]], etc.)
- [[CLI]] command handlers
- [[MCP Server]] tool handlers
- Error handling paths
- Edge cases documented in specs

## What Doesn't Need Tests

- Type definitions (TypeScript handles this)
- Pure configuration
- Third-party library internals
- Logging statements

## Test Organization

```
tests/
├── unit/
│   ├── core/
│   │   └── graph-core.test.ts
│   └── providers/
│       ├── store/
│       │   └── doc-store.test.ts
│       └── embedding/
│           └── transformers.test.ts
├── integration/
│   ├── doc-store.integration.test.ts
│   └── mcp-server.integration.test.ts
└── contracts/
    ├── store-provider.contract.test.ts
    └── embedding-provider.contract.test.ts
```

## Test Naming

Tests should read as specifications:

```typescript
describe('DocStore', () => {
  describe('getNode', () => {
    it('returns node when file exists', async () => { ... });
    it('returns null when file does not exist', async () => { ... });
    it('throws StoreError when file is malformed', async () => { ... });
  });
});
```

## Tooling

| Tool | Choice |
|------|--------|
| Test runner | Vitest |
| Coverage | @vitest/coverage-v8 |
| Config | `vitest.config.ts` at root |

### Coverage Thresholds

**100% lines. 100% branches. No exceptions.**

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
```

### Genuinely Untestable Lines

Some code legitimately cannot be tested (platform-specific branches, certain external library boundaries). For these cases:

1. **Exhaust all options first.** Can you mock it? Inject a dependency? Restructure to isolate the untestable part?
2. **If truly untestable**, use an ignore comment with mandatory explanation:

```typescript
/* v8 ignore next -- process.platform branch only hits on Windows, CI runs Linux */
if (process.platform === 'win32') {
  ...
}
```

Every ignore comment is a flag for future review. If the codebase accumulates more than a handful, something is wrong with the approach.

## Enforcement

- CI fails on test failures
- CI fails if coverage drops below 100%
- PRs require passing tests
- Code review verifies TDD was followed (test commits precede implementation commits where visible)
- Code review audits any `v8 ignore` comments

## Exceptions

None. If you think you need an exception, you're wrong.

Spike/prototype code lives in branches and gets deleted. Production code follows TDD.

## Related

- [[implementation-plan]] — Roadmap (all phases follow TDD)
- [[Decision - Error Contract]] — Error types that tests verify
- [[GraphCore]] — Core interfaces to test against
