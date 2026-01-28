---
tags:
  - consolidated
  - test-audit
  - flaky
  - timing
status: open
priority: medium
title: consolidated-timing-based-flakiness
---

# Consolidated: Timing-Based Test Flakiness

## Problem Pattern
Tests rely on fixed time delays or arbitrary thresholds to verify async behavior. These tests are inherently flaky - they pass on fast machines and fail on slow CI runners, or vice versa.

## Affected Locations

| File | Finding | Severity |
|------|---------|----------|
| tests/unit/embedding/transformers.test.ts | Pipeline caching uses `elapsed < 5000` | MEDIUM |
| tests/unit/docstore/file-watcher.test.ts | Real timer test uses exact timing (100ms, 150ms) | LOW |
| tests/unit/docstore/file-watcher.test.ts | Default debounce test asserts nothing (just `toBeDefined`) | HIGH |
| tests/integration/watcher/file-events.test.ts | Batching test accepts 1-3 batches (wide range) | HIGH |
| tests/integration/watcher/file-events.test.ts | Transient file test uses 50ms delay assumption | MEDIUM |
| tests/integration/watcher/file-events.test.ts | `WATCHER_STABILIZATION_MS = 100` is magic number | MEDIUM |

## Root Cause Analysis
Timing-based tests exist because:
1. **Real async behavior**: File watchers, debouncing genuinely involve time
2. **Easy to write**: `setTimeout` is simpler than event-driven assertions
3. **Works locally**: Developer machines are fast enough to pass

Problems occur when:
- CI runners are slower or more variable
- System load affects timing
- Boundary cases (barely passing/failing) flip randomly

## Fix Strategy

1. **Replace timing assertions with event/call counting**:
   ```typescript
   // Before (timing-based)
   const start = performance.now();
   await p.embed('second');
   expect(performance.now() - start).toBeLessThan(5000);
   
   // After (call-based)
   const pipelineSpy = vi.spyOn(transformers, 'pipeline');
   await p.embed('first');
   await p.embed('second');
   expect(pipelineSpy).toHaveBeenCalledTimes(1);
   ```

2. **Use fake timers for debounce tests**:
   ```typescript
   // Before (real timing)
   await new Promise(r => setTimeout(r, 100));
   expect(callback).not.toHaveBeenCalled();
   await new Promise(r => setTimeout(r, 150));
   expect(callback).toHaveBeenCalled();
   
   // After (fake timers)
   vi.useFakeTimers();
   
   triggerEvent('add', 'file.md');
   await vi.advanceTimersByTimeAsync(500);
   expect(callback).not.toHaveBeenCalled();
   
   await vi.advanceTimersByTimeAsync(600); // Total 1100ms > 1000ms debounce
   expect(callback).toHaveBeenCalledTimes(1);
   
   vi.useRealTimers();
   ```

3. **Use flush() for deterministic batch testing**:
   ```typescript
   // Before (wide acceptance range)
   expect(allChanges.length).toBeGreaterThanOrEqual(1);
   expect(allChanges.length).toBeLessThanOrEqual(3);
   
   // After (deterministic)
   triggerEvent('add', 'a.md');
   triggerEvent('add', 'b.md');
   triggerEvent('add', 'c.md');
   await watcher.flush();
   expect(callback).toHaveBeenCalledTimes(1);
   expect(callback).toHaveBeenCalledWith(['a.md', 'b.md', 'c.md']);
   ```

4. **Document magic numbers with rationale**:
   ```typescript
   /**
    * Stabilization delay for OS-level filesystem watcher.
    * 
    * WHY 100ms: Empirically determined on macOS 13 + Ubuntu 22.04.
    * FSEvents/inotify need time after chokidar 'ready' before delivering
    * events reliably. 50ms was flaky on CI, 100ms is stable.
    * 
    * If tests become flaky on new platforms, increase this value.
    */
   const WATCHER_STABILIZATION_MS = 100;
   ```

5. **Use vi.waitFor with meaningful conditions**:
   ```typescript
   // Before (arbitrary timeout)
   await new Promise(r => setTimeout(r, 2000));
   expect(callback).toHaveBeenCalled();
   
   // After (condition-based)
   await vi.waitFor(
     () => expect(callback).toHaveBeenCalled(),
     { timeout: 5000, interval: 50 }
   );
   ```

6. **Add large margins for CI environments**:
   ```typescript
   // If timing is truly necessary, use generous margins
   const DEBOUNCE_MS = 1000;
   const MARGIN = 500; // 50% margin for slow CI
   
   await new Promise(r => setTimeout(r, DEBOUNCE_MS + MARGIN));
   ```

## Verification
1. Run each timing test 100 times locally
2. Run on CI 10 times
3. If any run fails, the test is flaky and needs fixing
4. After fix, repeat until stable

## Source Audits
- [[audit-embedding-transformers-test]]
- [[audit-file-watcher-test]]
- [[audit-watcher-file-events-test]]
