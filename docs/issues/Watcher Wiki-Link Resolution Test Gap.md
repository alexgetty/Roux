---
type: Issue
priority: Low
component: DocStore
status: open
title: Watcher Wiki Link Resolution Test Gap
tags:
  - issue
  - watcher
  - testing
severity: Medium
phase: MVP
---

# Watcher Wiki-Link Resolution Test Gap

## Problem

Test "rebuilds graph after processing queue" (`tests/unit/docstore/watcher.test.ts:662-683`) uses `[[b]]` linking to `b.md` at root level. This passes without resolution because raw link matches node ID.

## Impact

If wiki-link resolution breaks for watcher events, test wouldn't catch it.

## Suggested Fix

Add test with nested paths:
```typescript
it('resolves wiki-links for files added via watcher', async () => {
  await writeMarkdownFile('folder/target.md', '---\ntitle: Target\n---\nContent');
  await store.sync();

  store.startWatching();
  await writeMarkdownFile('source.md', 'Link to [[target]]');
  triggerEvent('add', join(sourceDir, 'source.md'));

  await vi.waitFor(async () => {
    const node = await store.getNode('source.md');
    expect(node?.outgoingLinks).toContain('folder/target.md');
  }, { timeout: 2000 });
});
```

## References

- Red-team audit (2026-01-24)
