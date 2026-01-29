---
type: Enhancement
status: Proposed
priority: P3
effort: M
phase: Post-MVP
category: Infrastructure
---
# File Watcher Extraction

**Type:** Roadmap / Enhancement  
**Location:** `src/providers/docstore/index.ts` lines 300-437

## Current State

File watching and event debouncing logic is embedded in DocStore:
- Chokidar watcher setup
- Event queue management
- Debounce logic for batching changes
- Add/change/unlink event handling

## Potential Improvement

Extract as standalone utility that any StoreProvider could use:

```typescript
// utils/file-watcher.ts
export class FileWatcher {
  constructor(options: {
    patterns: string[];
    debounceMs: number;
    onChange: (events: FileEvent[]) => void;
  }) {}
  
  start(): void;
  stop(): void;
}
```

## Benefits

- DocStore becomes simpler
- Other file-based providers could reuse
- Easier to test watching logic in isolation
- Clear separation of concerns

## Recommendation

Implement as part of [[docstore-god-class]] refactor.
