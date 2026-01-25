# Red Team Round 6 Tech Debt

Medium priority issues from Red Team audit Round 6. All scoped to post-MVP unless blocking.

---

## handlers.test.ts

### 1. handleGetNode depth parsing assumes number
**Location:** `handlers.ts:78`

```typescript
const depth = (args.depth as number) ?? 0;
```

If MCP client sends `depth: "1"` (string), this becomes string `"1"` not number `1`. The comparison `depth === 0` fails, returning context response even with `depth: "0"` string.

**Fix:** Add coercion similar to `coerceLimit` or explicit validation.

---

### 2. handleRandomNode with empty array tags
**Location:** `handlers.ts:206-211`

Empty array `tags: []` passes validation and forwards to `core.getRandomNode([])`. Behavior is probably fine (return any random node), but contract isn't tested.

**Fix:** Add test for `tags: []` → should behave same as no tags.

---

### 3. dispatchTool doesn't validate tool name type
**Location:** `handlers.ts:340-368`

If `name` is not a string (e.g., `null`, `undefined`, number), `switch(name)` hits default and throws `Unknown tool: ${name}`. Works fine, but no explicit type check at entry.

**Priority:** Low — MCP SDK should validate.

---

## sqlite.test.ts

### 4. Concurrent read during write not tested
**Location:** `sqlite.test.ts:66-94`

Tests concurrent store calls but not: one thread storing while another searches. SQLite handles this, but with WAL mode the behavior might differ from default journal mode.

**Priority:** Matters if WAL mode added for performance.

---

### 5. Search with exactly limit vectors stored
**Location:** `sqlite.test.ts:118-127`

Tests `limit 2` with 4 vectors → returns 2. Doesn't test `limit 10` with exactly 10 vectors, or `limit 10` with 5 vectors.

**Fix:** Add boundary test: `search([...], 5)` when exactly 5 vectors exist → returns all 5.

---

## watcher.test.ts

### 6. add + unlink coalescing doesn't verify cache state
**Location:** `watcher.test.ts:380-401`

Test verifies `onChange` was called with `['persistent.md']` (transient file removed from queue). But doesn't verify `transient.md` isn't in cache.

**Fix:** Add assertion: `expect(await store.getNode('transient.md')).toBeNull()`

*Repeat from Round 5 (#8) — still open.*

---

### 7. File path normalization on Windows not tested
**Location:** `watcher.test.ts:267-283`, `docstore/index.ts:304`

`relative()` produces backslashes on Windows. `normalizeId()` handles this (converts `\` to `/`), but watcher tests only run on Unix paths.

**Fix:** Add comment noting Windows untested, or mock test with backslash paths.

---

## file-events.test.ts

### 8. Delete + immediate recreate race not tested
**Location:** `file-events.test.ts:133-155`

Tests "create then delete" (transient file). Doesn't test "delete then immediately recreate same filename" — edge case where user undoes a delete in Obsidian.

**Fix:** Add test: create file, sync, delete file, immediately create again with different content, verify final state.

---

### 9. Multiple files deleted simultaneously
**Location:** `file-events.test.ts:82-102`

Tests single file deletion. Doesn't test deleting 3+ files at once (e.g., user deletes a folder).

**Fix:** Add test: create `a.md`, `b.md`, `c.md`, sync, delete all three files, verify all removed from cache.

---

## Summary

| File | Count |
|------|-------|
| handlers.test.ts | 3 |
| sqlite.test.ts | 2 |
| watcher.test.ts | 2 |
| file-events.test.ts | 2 |
| **Total** | **9** |

All items are test coverage gaps — no blocking production bugs.
