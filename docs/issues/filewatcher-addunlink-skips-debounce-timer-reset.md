---
title: FileWatcher add+unlink Skips Debounce Timer Reset
tags:
  - issue
  - watcher
  - bug
---
# FileWatcher add+unlink Skips Debounce Timer Reset

**Type:** Bug
**Priority:** Medium
**Component:** FileWatcher

## Problem

When `add + unlink` coalesces to "no event", the debounce timer is still reset. This is inconsistent—if nothing will be emitted, why extend the debounce window?

More critically, if this is the ONLY event, the timer fires and calls `flush()` which does nothing (empty queue). Harmless but wasteful.

## Evidence

`watcher.ts:144-146`:
```typescript
} else if (existing === 'add' && event === 'unlink') {
  // add + unlink = remove from queue
  this.pendingChanges.delete(id);
}
// No return here - falls through to timer reset
```

Lines 163-169 always reset the timer regardless of what happened.

## Impact

Minor. The callback fires with an empty batch (which `flush()` handles by returning early). But it's a wasted timer cycle.

## Fix

Option 1: Return early after deleting:
```typescript
} else if (existing === 'add' && event === 'unlink') {
  this.pendingChanges.delete(id);
  // Don't reset timer if queue is now empty
  if (this.pendingChanges.size === 0 && this.debounceTimer) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }
  return;
}
```

Option 2: Accept the minor inefficiency, add comment explaining it.
