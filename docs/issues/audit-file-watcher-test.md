---
title: audit-file-watcher-test
tags:
  - test-audit
  - docstore
---
# Test Audit: file-watcher.test.ts

---
tags: [test-audit, docstore]
status: open
---

## Summary

The test file has good coverage of happy paths but relies heavily on mocking that obscures real behavior. Several tests verify implementation details rather than contracts, and some edge cases around path handling and timer management are either untested or test the wrong thing.

## Findings

### [HIGH] Test File Imports From Wrong Path
**Location:** `tests/unit/docstore/file-watcher.test.ts:5`
**Problem:** Import references `file-watcher.ts` but implementation is `watcher.ts`
**Evidence:**
```typescript
import { FileWatcher, EXCLUDED_DIRS, type FileEventType } from '../../../src/providers/docstore/watcher.js';
```
The filename doesn't match - test file is `file-watcher.test.ts` but imports from `watcher.js`. Minor naming inconsistency but could cause confusion.
**Fix:** Rename test file to `watcher.test.ts` to match implementation.
**Verification:** Check import resolves correctly.

### [HIGH] Mocking Undermines Coalescing Tests
**Location:** `tests/unit/docstore/file-watcher.test.ts:8-17, 34-43`
**Problem:** The mock watcher never actually delivers events to chokidar - tests call `triggerEvent()` which directly invokes handlers captured from `.on()` calls. This bypasses chokidar's actual behavior and only tests that handlers were registered.
**Evidence:**
```typescript
function triggerEvent(event: string, arg?: string | Error) {
  const mockWatcher = getMockWatcher();
  const onCalls = mockWatcher.on.mock.calls;
  const handler = onCalls.find((call: unknown[]) => call[0] === event)?.[1] as
    | ((arg?: string | Error) => void)
    | undefined;
  if (handler) {
    handler(arg);
  }
}
```
If handler is not found, `triggerEvent` silently does nothing. Multiple tests could pass by accident if event registration changed.
**Fix:** Add assertion inside `triggerEvent` to throw if handler not found. This ensures tests fail fast if event registration breaks.
**Verification:** Temporarily break `.on('add', ...)` registration and verify tests fail.

### [HIGH] Default Debounce Test Asserts Nothing
**Location:** `tests/unit/docstore/file-watcher.test.ts:673-690`
**Problem:** Test claims to verify 1000ms default debounce but actually just checks `watcher` is defined.
**Evidence:**
```typescript
it('uses default 1000ms debounce when not specified', () => {
  // ...
  // Implementation should use 1000ms default
  // We test this indirectly through real timer test above
  expect(watcher).toBeDefined();  // THIS TESTS NOTHING
  watcher.stop();
});
```
This test passes if default is 0ms, 10 seconds, or anything else.
**Fix:** Either expose `debounceMs` via getter and test directly, or use real timers with proper timing assertions (as suggested in `docs/issues/filewatcher-default-debounce-not-directly-tested.md`).
**Verification:** Change `DEFAULT_DEBOUNCE_MS` to 5000 and verify test fails.

### [MEDIUM] EXCLUDED_DIRS Immutability Test Is Meaningless
**Location:** `tests/unit/docstore/file-watcher.test.ts:847-852`
**Problem:** TypeScript types don't exist at runtime. The test only checks the Set exists.
**Evidence:**
```typescript
it('is immutable (ReadonlySet)', () => {
  // TypeScript enforces this at compile time
  // We just verify the type exists and has expected values
  expect(EXCLUDED_DIRS).toBeDefined();
});
```
**Fix:** Either delete this test (it provides no value) or actually test runtime immutability by attempting mutation and verifying it fails/is ignored.
**Verification:** N/A - delete or rewrite.

### [MEDIUM] Windows Path Normalization Not Tested
**Location:** `tests/unit/docstore/file-watcher.test.ts:421-437`
**Problem:** Nested path test uses forward slashes only. Implementation has backslash replacement at line 157 of `watcher.ts`:
```typescript
const id = relativePath.toLowerCase().replace(/\\/g, '/');
```
But no test verifies this works.
**Evidence:** All path tests use `join()` which produces forward slashes on macOS/Linux.
**Fix:** Add explicit test with backslash-containing path (simulating Windows `relative()` output).
**Verification:** Test with path containing `\\` and verify output uses `/`.

### [MEDIUM] triggerReady() Not Awaited Before triggerEvent()
**Location:** `tests/unit/docstore/file-watcher.test.ts:226-241` and multiple other locations
**Problem:** Several tests call `watcher.start()` but don't await the promise before triggering events. The mock makes this work, but it's testing unrealistic scenarios.
**Evidence:**
```typescript
it('ignores files not in extensions set', () => {
  const onBatch = vi.fn();
  const watcher = new FileWatcher({ ... });
  watcher.start();  // Not awaited!
  triggerReady();   // Manually triggers ready
  
  triggerEvent('add', ...);
  // ...
});
```
In reality, events shouldn't arrive before ready fires. The mock setup allows this but it tests an impossible scenario.
**Fix:** Always await `watcher.start()` after calling `triggerReady()` for accurate sequencing.
**Verification:** Add assertion that `isWatching()` is true before triggering file events.

### [MEDIUM] add+unlink Timer Behavior Untested
**Location:** Implementation `watcher.ts:166-168`
**Problem:** When `add + unlink` cancels out, the debounce timer is still reset/running. If this is the only event, timer fires and `flush()` does nothing. Not tested.
**Evidence:** Test at line 458-474 verifies callback isn't called, but doesn't verify timer state. Known issue in `docs/issues/filewatcher-addunlink-skips-debounce-timer-reset.md`.
**Fix:** Add test verifying timer is cleared when queue becomes empty after `add + unlink`.
**Verification:** Expose timer state or test via timing assertions.

### [LOW] flush() Timing Race in Real Timer Test
**Location:** `tests/unit/docstore/file-watcher.test.ts:633-671`
**Problem:** Test uses real timers but relies on exact timing (100ms, 150ms delays). On slow CI, timing could drift causing flakiness.
**Evidence:**
```typescript
await new Promise((r) => setTimeout(r, 100));
expect(onBatch).not.toHaveBeenCalled();

triggerEvent('add', join(sourceDir, 'second.md'));

await new Promise((r) => setTimeout(r, 100));
expect(onBatch).not.toHaveBeenCalled();

await new Promise((r) => setTimeout(r, 150));
expect(onBatch).toHaveBeenCalledTimes(1);
```
If execution slows by 50ms, assertions could fail/pass incorrectly.
**Fix:** Use larger margins or fake timers with `vi.advanceTimersByTime()`.
**Verification:** Run test 100 times, check for flakes.

### [LOW] No Test for Error During ready Wait
**Location:** `tests/unit/docstore/file-watcher.test.ts:758-773`
**Problem:** Tests error that occurs before ready, and error that occurs after ready, but not error during the "waiting for ready" phase with other events queued.
**Evidence:** The error handling test at 758-773 tests EMFILE before ready fires. Test at 946-972 tests error after ready. Neither tests what happens if error fires while events are queued but before ready completes.
**Fix:** Add test: start watcher, queue some events via triggerEvent, then fire error before triggerReady. Verify promise rejects and events are discarded.
**Verification:** Test shows events not delivered and promise rejects.

### [LOW] Missing Extension Edge Cases
**Location:** `tests/unit/docstore/file-watcher.test.ts:300-322`
**Problem:** Tests case-insensitive matching but doesn't test extensions with multiple dots.
**Evidence:** No test for files like `file.test.md` or `archive.tar.gz` - does `extname()` handle these correctly? (It does - returns `.md` and `.gz` respectively, but test doesn't verify.)
**Fix:** Add test with `test.spec.md` to verify only final extension is checked.
**Verification:** File with multiple dots returns correct extension match.

## Already Known Issues (Skipped)

The following issues are already documented and not duplicated here:
- `docs/issues/filewatcher-windows-path-not-tested.md` - covered in finding above
- `docs/issues/filewatcher-default-debounce-not-directly-tested.md` - covered in finding above
- `docs/issues/excludeddirs-immutability-test-is-weak.md` - covered in finding above
- `docs/issues/filewatcher-addunlink-skips-debounce-timer-reset.md` - covered in finding above
- `docs/issues/docstore-filewatcher-injection-not-tested.md` - DocStore level, not FileWatcher unit test
- `docs/issues/duplicate-event-coalescing-untested.md` - OUTDATED: tests now exist at lines 563-599

## References

- Implementation: `/Users/alex/Repos/Roux/src/providers/docstore/watcher.ts`
- Test file: `/Users/alex/Repos/Roux/tests/unit/docstore/file-watcher.test.ts`
