# Red Team Round 9 Tech Debt

DocStore audit findings. Medium priority — valid issues but not blocking.

## docstore.test.ts

### Line 195: Timing-based mtime test
50ms timeout for mtime change detection. On slow CI, filesystem mtime resolution could be coarser. Consider mocking mtime or using larger margin with comment explaining why.

### Lines 929-958: Monkey-patching prototype
Fragile test pattern using `@ts-expect-error` to access private method. If implementation changes method name or makes it truly private, test breaks silently. Consider injecting a testable seam instead.

### Line 1245: nodesExist normalization not explicitly verified
Test checks `exists.md` and `also-exists.md` but inputs were `EXISTS.MD`, `ALSO-EXISTS.md`. Implementation normalizes inputs then returns normalized keys. Test passes but doesn't explicitly assert the key transformation behavior.

## watcher.test.ts

### Lines 163-181: Inconsistent timeout values
Test uses `vi.waitFor` with 2000ms timeout. Real debounce is 1000ms. Extra buffer is reasonable but inconsistent across tests (some use 1500ms fake timers, some 2000ms real waitFor). Standardize.

### Line 599: Race condition not fully verified
`nonexistent.md` triggers warning but doesn't test what happens if file appears between `queueChange` and `processQueue`. ENOENT handling exists in sync(), but test doesn't verify node is NOT added to cache for failed parse.

## cache.test.ts

### Lines 397-404: Accessing private db field
`@ts-expect-error` to access private field for test verification. Fragile. Consider exposing a `getRawEmbeddingSize(id)` test-only method or trusting the implementation.

### No defensive SQL injection test
`listNodes` uses parameterized queries (safe), but a test confirming bad input like `'; DROP TABLE nodes; --'` doesn't crash would be defensive documentation.

## parser.test.ts

### Line 77-87: Malformed YAML test incomplete
Only checks content contains "Content". Doesn't verify that malformed frontmatter doesn't partially pollute properties. Add explicit assertion that `result.properties` is empty.

### Lines 287-300: Misleading comment
Comment says "tested via DocStore integration" but there's no explicit integration test file. Behavior IS tested in docstore.test.ts lines 98-126. Comment is accurate but misleading — should reference the actual location.

## index.ts (implementation)

### processQueue error handling edge case
Lines 397-437: If ALL items in processQueue fail (caught at 421-423), `processedIds.length` is 0, no graph rebuild. If files exist in cache from previous sync, graph could be stale. Very unlikely but worth awareness.
