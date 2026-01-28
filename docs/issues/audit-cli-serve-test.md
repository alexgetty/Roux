---
tags:
  - test-audit
  - cli
status: open
title: audit-cli-serve-test
---

# Test Audit: cli/serve.test.ts

## Summary

The serve command tests have significant gaps around error handling, config parsing, embedding failures, and cleanup edge cases. Several happy paths are tested but failure modes and boundary conditions are largely untested.

## Findings

### [CRITICAL] Embedding failure during startup not tested

**Location:** `src/cli/commands/serve.ts:61-75`
**Problem:** The embedding loop has no error handling. If `embedding.embed()` fails for any node, the entire serve command crashes. No test verifies this behavior or that it degrades gracefully.

**Evidence:**
```typescript
// serve.ts:61-75
for (let i = 0; i < allNodeIds.length; i++) {
  const id = allNodeIds[i]!;
  if (!hasExistingEmbedding(store, id)) {
    const node = await store.getNode(id);
    if (node && node.content) {
      const vector = await embedding.embed(node.content);  // Can throw - unhandled
      await store.storeEmbedding(id, vector, embedding.modelId());
    }
  }
  if (onProgress) {
    onProgress(i + 1, total);
  }
}
```

**Fix:** Add test that mocks `TransformersEmbeddingProvider.embed()` to throw, verify serve either degrades gracefully (skips bad nodes) or throws a clear error.

**Verification:** Test should pass when implementation either catches and logs errors per-node, or propagates a clear error message.

---

### [HIGH] Malformed config file not tested

**Location:** `src/cli/commands/serve.ts:37-39`
**Problem:** Config is parsed with `parseYaml(configContent)` and cast directly to `RouxConfig`. No test for:
- Empty config file
- Invalid YAML syntax
- Valid YAML but invalid schema (missing `providers` key)
- Config with unknown embedding provider type

**Evidence:**
```typescript
// serve.ts:37-39
const configContent = await readFile(configPath, 'utf-8');
const config = parseYaml(configContent) as RouxConfig;  // No validation
```

**Fix:** Add tests for malformed config scenarios:
1. Empty file
2. `invalid: yaml: syntax: [}`
3. `source: {path: "."}`  (missing required `providers`)
4. Valid but with `providers.embedding.type: "unknown"`

**Verification:** Each test should verify appropriate error is thrown with useful message.

---

### [HIGH] Cleanup on partial initialization failure not tested

**Location:** `src/cli/commands/serve.ts:47-89`
**Problem:** If initialization fails after creating `store` but before returning `handle`, resources may leak. For example, if `mcpServer.start()` fails, `store` is never closed.

**Evidence:**
```typescript
// serve.ts:47-89
const store = new DocStore(resolvedSourcePath, resolvedCachePath);
// ... creates embedding provider
await store.sync();
// ... generates embeddings
const core = new GraphCoreImpl();
core.registerStore(store);
core.registerEmbedding(embedding);

const mcpServer = new McpServer({...});
await mcpServer.start(transportFactory);  // If this throws, store is leaked

// ... file watcher setup

return { stop: async () => { store.close(); ... } };  // Never reached on failure
```

**Fix:** Add test where `transportFactory().start()` throws, verify `store.close()` is still called.

**Verification:** Spy on `DocStore.prototype.close`, verify it's called even when `mcpServer.start()` fails.

---

### [MEDIUM] watch callback embedding failure not tested

**Location:** `src/cli/commands/serve.ts:94-103`
**Problem:** The file watcher callback generates embeddings for changed nodes but has no error handling. If embedding fails for a changed file, the error is not caught.

**Evidence:**
```typescript
// serve.ts:94-103
await store.startWatching(async (changedIds) => {
  for (const id of changedIds) {
    const node = await store.getNode(id);
    if (node && node.content) {
      const vector = await embedding.embed(node.content);  // Can throw
      await store.storeEmbedding(id, vector, embedding.modelId());
    }
  }
});
```

**Fix:** Add test that triggers a file change, mocks `embed()` to throw, verifies server continues running (graceful degradation) or error is logged.

**Verification:** After embedding failure in callback, subsequent operations should still work.

---

### [MEDIUM] Empty directory startup not tested

**Location:** `tests/unit/cli/serve.test.ts`
**Problem:** All tests create at least one markdown file. No test verifies serve works with zero nodes (empty but initialized directory).

**Evidence:** Every test in the file does:
```typescript
await initCommand(testDir);
await writeFile(join(testDir, 'test.md'), '# Test', 'utf-8');  // Always creates a file
```

**Fix:** Add test that initializes directory, runs serve with no files, verifies `nodeCount === 0` and server is functional.

**Verification:** `handle.nodeCount` should be 0, `handle.stop()` should succeed.

---

### [MEDIUM] Config with custom embedding model not tested

**Location:** `src/cli/commands/serve.ts:48-52`
**Problem:** Tests use default config but the code has specific logic for custom embedding models that is never exercised.

**Evidence:**
```typescript
// serve.ts:48-52
const embedding = new TransformersEmbeddingProvider(
  config.providers?.embedding?.type === 'local'
    ? config.providers.embedding.model
    : undefined
);
```

**Fix:** Add test with `providers.embedding.type: 'local'` and `model: 'custom-model'`, verify the model is used.

**Verification:** Spy on `TransformersEmbeddingProvider` constructor, verify custom model is passed.

---

### [LOW] nodeCount is snapshot, not live value

**Location:** `src/cli/commands/serve.ts:119`
**Problem:** `nodeCount` is captured at startup time (`allNodeIds.length`). If files are added/removed while watching, `nodeCount` becomes stale. Tests don't verify this behavior.

**Evidence:**
```typescript
return {
  stop: async () => {...},
  isWatching: store.isWatching(),
  nodeCount: allNodeIds.length,  // Captured once, never updated
};
```

**Fix:** Document that `nodeCount` is a startup snapshot OR change to getter that queries store. Add test clarifying expected behavior.

**Verification:** Add/remove file while watching, check if `nodeCount` reflects change (it shouldn't with current implementation).

---

### [LOW] stop() idempotency not tested

**Location:** `tests/unit/cli/serve.test.ts`
**Problem:** No test calls `stop()` twice to verify it's idempotent and doesn't throw.

**Evidence:** All tests call `await handle.stop();` exactly once.

**Fix:** Add test that calls `stop()` twice, verify no error thrown.

**Verification:** Second `stop()` call should not throw.

---

### [LOW] Non-markdown files in directory not tested

**Location:** `tests/unit/cli/serve.test.ts`
**Problem:** Tests only create `.md` files. No test verifies that non-markdown files (`.txt`, `.json`, images) are correctly ignored.

**Fix:** Add test with mixed file types, verify only `.md` files are counted in `nodeCount`.

**Verification:** Create `test.md`, `test.txt`, `test.json`, verify `nodeCount === 1`.

## Previously Documented (no action needed)

The following gaps are already tracked in `docs/issues/cli-command-test-gaps.md`:
- Transport mock hides MCP failures (item #2)
- serve sync test doesn't verify node correctness (item #3)
