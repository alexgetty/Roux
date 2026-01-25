---
type: Issue
severity: High
component: DocStore
phase: MVP
---

# Wiki-Link Resolution

Wiki-links don't resolve to full paths, causing zero edges in graphs with nested directory structures.

## Problem

Obsidian wiki-links like `[[Lemon]]` don't include paths. Obsidian resolves them by searching all files for a matching filename. Roux normalizes `[[Lemon]]` to `lemon.md`, but actual node IDs include directory paths like `graph/ingredients/lemon.md`.

**Result:** Links are extracted but never match node IDs. Edge count = 0.

## Reproduction

```bash
# Any Obsidian vault with nested folders and wiki-links
cd ~/my-vault
roux init
roux serve
roux status
# Nodes: 393, Edges: 0
```

## Evidence

Cache shows links extracted correctly but as bare filenames:

```sql
sqlite3 .roux/cache.db "SELECT id, outgoing_links FROM nodes WHERE id LIKE '%salmon%'"
```

```
graph/recipes/blackened salmon.md | ["lemon.md","salmon filet.md","tbsp.md",...]
```

But actual node IDs are:

```
graph/ingredients/lemon.md
graph/ingredients/salmon filet.md
graph/units/tbsp.md
```

The link `lemon.md` ≠ node ID `graph/ingredients/lemon.md`, so no edge forms.

## Current Behavior

`normalizeWikiLink()` in `src/providers/docstore/index.ts:478-488`:

```typescript
private normalizeWikiLink(target: string): string {
  let normalized = target.toLowerCase().replace(/\\/g, '/');
  if (!this.hasFileExtension(normalized)) {
    normalized += '.md';
  }
  return normalized;
}
```

This produces `lemon.md` from `[[Lemon]]` — correct normalization, but no path resolution.

## Required Behavior

After parsing all files, resolve bare wiki-links to full node IDs:

```
[[Lemon]] → lookup "lemon.md" in all nodes → "graph/ingredients/lemon.md"
```

## Implementation Approach

### 1. Build filename→path index after sync

In `sync()`, after processing all files:

```typescript
private buildFilenameIndex(): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const node of this.cache.getAllNodes()) {
    const basename = node.id.split('/').pop()!; // "lemon.md"
    const existing = index.get(basename) ?? [];
    existing.push(node.id);
    index.set(basename, existing);
  }
  return index;
}
```

### 2. Resolve links during or after parsing

Option A: Resolve during `fileToNode()` (requires index to exist first — chicken/egg)

Option B: Post-process after all nodes parsed:

```typescript
private resolveLinks(filenameIndex: Map<string, string[]>): void {
  for (const node of this.cache.getAllNodes()) {
    const resolved = node.outgoingLinks.map(link => {
      const matches = filenameIndex.get(link);
      if (matches && matches.length > 0) {
        return matches[0]; // Take first match
      }
      return link; // Unresolved — keep as-is
    });
    // Update node in cache with resolved links
  }
}
```

### 3. Handle ambiguity

Multiple files with same basename (e.g., `notes/lemon.md` and `recipes/lemon.md`):

- **Option 1:** First match wins (deterministic by sort order)
- **Option 2:** Warn on ambiguity, pick closest by path similarity
- **Option 3:** Store all matches, let graph have multiple edges

Recommend Option 1 for MVP — matches Obsidian's "first found" behavior.

## Files to Modify

1. `src/providers/docstore/index.ts`
   - Add `buildFilenameIndex()` method
   - Add `resolveOutgoingLinks()` method
   - Call both at end of `sync()`
   - Update `rebuildGraph()` if needed

2. `src/providers/docstore/cache.ts`
   - May need method to bulk-update outgoing_links

## Test Cases

```typescript
describe('wiki-link resolution', () => {
  it('resolves bare filename to full path', async () => {
    await writeMarkdownFile('folder/target.md', '---\ntitle: Target\n---\nContent');
    await writeMarkdownFile('source.md', '---\ntitle: Source\n---\nLinks to [[target]]');
    await store.sync();

    const source = await store.getNode('source.md');
    expect(source!.outgoingLinks).toContain('folder/target.md');
  });

  it('handles case-insensitive matching', async () => {
    await writeMarkdownFile('Items/Lemon.md', '---\ntitle: Lemon\n---\n');
    await writeMarkdownFile('recipe.md', '---\ntitle: Recipe\n---\n[[lemon]]');
    await store.sync();

    const recipe = await store.getNode('recipe.md');
    expect(recipe!.outgoingLinks).toContain('items/lemon.md');
  });

  it('resolves aliased links', async () => {
    await writeMarkdownFile('people/john.md', '---\ntitle: John\n---\n');
    await writeMarkdownFile('note.md', '---\ntitle: Note\n---\n[[john|John Smith]]');
    await store.sync();

    const note = await store.getNode('note.md');
    expect(note!.outgoingLinks).toContain('people/john.md');
  });

  it('leaves unresolvable links as-is', async () => {
    await writeMarkdownFile('note.md', '---\ntitle: Note\n---\n[[nonexistent]]');
    await store.sync();

    const note = await store.getNode('note.md');
    expect(note!.outgoingLinks).toContain('nonexistent.md');
  });

  it('picks first match for ambiguous filenames', async () => {
    await writeMarkdownFile('a/item.md', '---\ntitle: Item A\n---\n');
    await writeMarkdownFile('b/item.md', '---\ntitle: Item B\n---\n');
    await writeMarkdownFile('note.md', '---\ntitle: Note\n---\n[[item]]');
    await store.sync();

    const note = await store.getNode('note.md');
    // Should resolve to one of them (alphabetically first)
    expect(note!.outgoingLinks).toContain('a/item.md');
  });
});
```

## Graph Builder Impact

`src/graph/builder.ts` creates edges from `node.outgoingLinks`. Once links are resolved to full paths, edges will form correctly — no changes needed there.

## Performance Consideration

Building filename index is O(n) where n = number of nodes. Resolution is O(m) where m = total links across all nodes. Both are fast for <10k nodes.

## References

- Obsidian link resolution: https://help.obsidian.md/Linking+notes+and+files/Internal+links
- Current implementation: `src/providers/docstore/index.ts:478-488`
- Graph builder: `src/graph/builder.ts`
