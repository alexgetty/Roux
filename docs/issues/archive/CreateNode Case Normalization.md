---
id: mDApQl1Ankcp
title: Createnode Case Normalization
tags:
  - issue
  - docstore
  - testing
type: Issue
priority: Medium
component: DocStore
status: open
severity: High
phase: 6
---
# CreateNode Case Normalization

Missing test for ID case normalization in `createNode`.

## Problem

`createNode` normalizes the ID at `index.ts:77`:

```typescript
const normalizedId = normalizeId(node.id);
```

But tests only pass already-normalized IDs like `'new-note.md'`.

Untested: What happens with `'NEW-Note.MD'`?
- Does the file get created as `new-note.md`?
- Does the cache store it correctly?
- Can we retrieve it with either case?

## Risk

If normalization doesn't work as expected, files could be created with unexpected names, or the cache could become inconsistent with the filesystem.

## Suggested Tests

```typescript
it('normalizes ID when creating node', async () => {
  const node: Node = {
    id: 'UPPERCASE.MD',
    title: 'Test',
    content: 'Content',
    tags: [],
    outgoingLinks: [],
    properties: {},
  };

  await store.createNode(node);

  // File should be created with lowercase name
  const filePath = join(sourceDir, 'uppercase.md');
  await expect(readFile(filePath, 'utf-8')).resolves.toBeDefined();

  // Should be retrievable with any case
  expect(await store.getNode('uppercase.md')).not.toBeNull();
  expect(await store.getNode('UPPERCASE.MD')).not.toBeNull();
});

it('creates nested directories with normalized path', async () => {
  const node: Node = {
    id: 'Folder/SubFolder/Note.MD',
    title: 'Test',
    content: '',
    tags: [],
    outgoingLinks: [],
    properties: {},
  };

  await store.createNode(node);

  // Path should be normalized
  const filePath = join(sourceDir, 'folder/subfolder/note.md');
  await expect(readFile(filePath, 'utf-8')).resolves.toBeDefined();
});
```

## References

- `src/providers/docstore/index.ts:76-104`
- `src/providers/docstore/parser.ts:90-92` (normalizeId)
