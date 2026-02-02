---
id: YbyXoj-vRSW6
title: audit-cli-init-test
tags:
  - test-audit
  - cli
status: open
---
# Test Audit: cli/init.test.ts

**Consolidated into:** [[consolidated-error-propagation-gaps]], [[consolidated-weak-assertions]]

## Summary

The init command test suite has reasonable coverage for happy paths but lacks critical error handling tests, boundary conditions, and verification of implementation details that could silently regress.

## Findings

### [HIGH] Malformed .mcp.json overwrites user data without test

**Location:** `src/cli/commands/init.ts:104-109`, test file lacks coverage

**Problem:** When `.mcp.json` contains invalid JSON, `updateMcpConfig` catches the error and starts fresh with an empty config. This means a user's malformed but recoverable file gets silently replaced. The test suite covers malformed `.claude/settings.json` (line 286-298) but NOT malformed `.mcp.json`.

**Evidence:** Implementation silently replaces:
```typescript
// init.ts:104-109
try {
  const content = await readFile(mcpPath, 'utf-8');
  config = JSON.parse(content) as McpConfig;
} catch {
  // File doesn't exist or invalid JSON — start fresh
}
```

**Note:** Issue `Init Malformed JSON Test Gap.md` exists but only suggests testing that init succeeds. It does NOT verify the concerning behavior: that malformed JSON is OVERWRITTEN rather than preserved.

**Fix:** Add test verifying behavior is intentional:
```typescript
it('overwrites malformed .mcp.json with valid config', async () => {
  const mcpPath = join(testDir, '.mcp.json');
  await writeFile(mcpPath, '{ invalid json', 'utf-8');

  await initCommand(testDir);

  const content = await readFile(mcpPath, 'utf-8');
  const config = JSON.parse(content);
  expect(config.mcpServers.roux).toBeDefined();
  // Document: malformed files are replaced, not preserved
});
```

**Verification:** Test file should contain explicit coverage for malformed `.mcp.json` behavior.

---

### [HIGH] getStoreType YAML parsing is fragile and untested

**Location:** `src/cli/commands/init.ts:131-138`

**Problem:** The store type detection uses a regex that assumes specific YAML formatting. Alternative valid YAML structures would fail silently.

**Evidence:**
```typescript
// init.ts:135
const typeMatch = content.match(/store:\s*\n\s*type:\s*(\w+)/);
```

This regex requires:
- `store:` followed by newline
- `type:` on next line with specific spacing
- Fails for: inline syntax (`store: { type: docstore }`), different indentation, comments between lines

**Fix:** Add tests for edge cases:
```typescript
it('detects store type with inline YAML syntax', async () => {
  const configPath = join(testDir, 'roux.yaml');
  await writeFile(configPath, 'providers:\n  store: { type: memory }\n', 'utf-8');
  
  await initCommand(testDir);
  
  // Should NOT install hooks for memory store
  const settingsPath = join(testDir, '.claude', 'settings.json');
  // verify no hook installed
});

it('defaults to docstore when YAML structure is unexpected', async () => {
  const configPath = join(testDir, 'roux.yaml');
  await writeFile(configPath, '# just a comment\n', 'utf-8');
  
  await initCommand(testDir);
  
  // Should install hooks (docstore is default)
});
```

**Verification:** Test suite covers non-standard YAML formatting scenarios.

---

### [MEDIUM] Return value assertions are incomplete

**Location:** `tests/unit/cli/init.test.ts:21-31`

**Problem:** First init test only checks `result.created`. The return type `InitResult` has three fields (`created`, `configPath`, `hooksInstalled`) but only `created` is verified on first init.

**Evidence:**
```typescript
// init.test.ts:21-31
it('creates roux.yaml with minimal defaults', async () => {
  const result = await initCommand(testDir);
  // ...
  expect(result.created).toBe(true);
  // Missing: configPath and hooksInstalled assertions
});
```

Compare to re-init test (line 40-46) which does check `configPath`.

**Fix:** Complete the assertions:
```typescript
expect(result.created).toBe(true);
expect(result.configPath).toBe(join(testDir, 'roux.yaml'));
expect(result.hooksInstalled).toBe(true);
```

**Verification:** All return value fields are asserted in at least one test.

---

### [MEDIUM] Hook command content test is fragile

**Location:** `tests/unit/cli/init.test.ts:300-317`

**Problem:** Test verifies hook command contains `.md` and matches `/mcp.*roux|roux.*mcp/i` but doesn't verify the actual rejection behavior works.

**Evidence:**
```typescript
// init.test.ts:313-316
expect(command).toContain('.md');
expect(command).toMatch(/mcp.*roux|roux.*mcp/i);
```

The actual hook is a node one-liner that parses JSON from stdin and checks `file_path`. This test doesn't verify:
- The node command is valid syntax
- The exit code (2) for rejection
- The JSON parsing logic works
- Edge cases (file_path missing, null, etc.)

**Fix:** Add integration test that actually runs the hook:
```typescript
it('hook command rejects .md files with exit code 2', async () => {
  await initCommand(testDir);
  
  const settingsPath = join(testDir, '.claude', 'settings.json');
  const config = JSON.parse(await readFile(settingsPath, 'utf-8'));
  const command = config.hooks.PreToolUse.find(h => 
    h.hooks?.some(hook => hook.command?.includes(HOOK_MARKER))
  ).hooks[0].command;
  
  const input = JSON.stringify({ tool_input: { file_path: 'docs/test.md' } });
  const { exitCode } = await execWithStdin(command, input);
  expect(exitCode).toBe(2);
});

it('hook command allows non-.md files with exit code 0', async () => {
  // Similar test with file_path: 'src/index.ts'
  expect(exitCode).toBe(0);
});
```

**Verification:** Hook behavior is tested end-to-end, not just string content.

---

### [MEDIUM] No test for permission errors

**Location:** `src/cli/commands/init.ts:77`, `94`, `120`, `152`, `190`

**Problem:** Multiple `mkdir` and `writeFile` calls could fail due to permissions. No tests verify graceful handling.

**Evidence:** Implementation has no try/catch around file writes:
```typescript
// init.ts:94
await writeFile(configPath, DEFAULT_CONFIG, 'utf-8');
// Throws if directory is read-only
```

**Fix:** Add permission error tests (may require mocking fs):
```typescript
it('throws descriptive error when directory is not writable', async () => {
  // Make testDir read-only
  await chmod(testDir, 0o444);
  
  await expect(initCommand(testDir)).rejects.toThrow(/permission|EACCES/i);
});
```

**Verification:** Error scenarios have explicit test coverage.

---

### [MEDIUM] Race condition in idempotency not tested

**Location:** `tests/unit/cli/init.test.ts:271-284`

**Problem:** Re-init test runs sequentially. In real usage, concurrent inits could race on file writes.

**Evidence:**
```typescript
// init.test.ts:271-274
await initCommand(testDir);
await initCommand(testDir);
```

**Fix:** Add concurrent init test:
```typescript
it('handles concurrent init calls without corruption', async () => {
  await Promise.all([
    initCommand(testDir),
    initCommand(testDir),
    initCommand(testDir),
  ]);
  
  // Verify final state is valid
  const settings = JSON.parse(await readFile(settingsPath, 'utf-8'));
  expect(settings.hooks.PreToolUse.filter(h => 
    h.hooks?.some(hook => hook.command?.includes(HOOK_MARKER))
  )).toHaveLength(1);
});
```

**Verification:** Concurrent operations don't corrupt state.

---

### [LOW] Missing test for nonexistent parent directory

**Location:** `tests/unit/cli/init.test.ts` (missing)

**Problem:** No test for `initCommand('/nonexistent/deep/path')`. Already noted in `cli-command-test-gaps.md` but remains unfixed.

**Evidence:** Test setup always creates `testDir` first (line 14).

**Fix:** Per existing issue, add:
```typescript
it('creates nested directories when parent does not exist', async () => {
  const nestedDir = join(testDir, 'deep', 'nested', 'path');
  const result = await initCommand(nestedDir);
  expect(result.created).toBe(true);
});
```

**Verification:** `initCommand` works with deeply nested nonexistent paths.

---

### [LOW] HOOK_MARKER is exported but test uses hardcoded string

**Location:** `tests/unit/cli/init.test.ts:151`

**Problem:** Test file declares `const HOOK_MARKER = 'roux-enforce-mcp'` instead of importing from implementation. If the marker changes in implementation, test would pass incorrectly.

**Evidence:**
```typescript
// init.test.ts:151
const HOOK_MARKER = 'roux-enforce-mcp';

// init.ts:53
export const HOOK_MARKER = 'roux-enforce-mcp';
```

**Fix:** Import the constant:
```typescript
import { initCommand, HOOK_MARKER } from '../../../src/cli/commands/init.js';
```

**Verification:** Single source of truth for HOOK_MARKER.

---

### [LOW] Default config content not validated

**Location:** `tests/unit/cli/init.test.ts:21-31`

**Problem:** Test uses `toContain` for loose matching. Doesn't verify the complete config structure is valid YAML or matches expected schema.

**Evidence:**
```typescript
// init.test.ts:27-29
expect(content).toContain('providers:');
expect(content).toContain('store:');
expect(content).toContain('type: docstore');
```

A file containing `"providers: store: type: docstore"` on one malformed line would pass.

**Fix:** Parse and validate:
```typescript
import YAML from 'yaml';

it('creates valid YAML config', async () => {
  const result = await initCommand(testDir);
  const content = await readFile(join(testDir, 'roux.yaml'), 'utf-8');
  
  const config = YAML.parse(content);
  expect(config.providers.store.type).toBe('docstore');
});
```

**Verification:** Generated config is structurally valid.

## Cross-References

- `docs/issues/Init Malformed JSON Test Gap.md` - Overlaps with finding #1 but this audit is more specific
- `docs/issues/cli-command-test-gaps.md` - Finding #7 duplicates issue #1 from that doc
