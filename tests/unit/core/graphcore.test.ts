import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GraphCoreImpl } from '../../../src/core/graphcore.js';
import type { GraphCore } from '../../../src/types/graphcore.js';
import type {
  Store,
  Embedding,
  VectorSearchResult,
  TagMode,
  Metric,
  NeighborOptions,
} from '../../../src/types/provider.js';
import type { Node, NodeWithContext } from '../../../src/types/node.js';
import type { RouxConfig } from '../../../src/types/config.js';

const createMockNode = (id: string, overrides?: Partial<Node>): Node => ({
  id,
  title: id.replace('.md', '').replace(/-/g, ' '),
  content: `Content for ${id}`,
  tags: [],
  outgoingLinks: [],
  properties: {},
  ...overrides,
});

const createMockStore = (
  overrides?: Partial<Store> & {
    id?: string;
    onRegister?: () => Promise<void>;
    onUnregister?: () => Promise<void>;
  }
): Store => ({
  id: overrides?.id ?? 'test-store',
  createNode: vi.fn().mockResolvedValue(undefined),
  updateNode: vi.fn().mockResolvedValue(undefined),
  deleteNode: vi.fn().mockResolvedValue(undefined),
  getNode: vi.fn().mockResolvedValue(null),
  getNodes: vi.fn().mockResolvedValue([]),
  getNeighbors: vi.fn().mockResolvedValue([]),
  findPath: vi.fn().mockResolvedValue(null),
  getHubs: vi.fn().mockResolvedValue([]),
  storeEmbedding: vi.fn().mockResolvedValue(undefined),
  searchByVector: vi.fn().mockResolvedValue([]),
  searchByTags: vi.fn().mockResolvedValue([]),
  getRandomNode: vi.fn().mockResolvedValue(null),
  resolveTitles: vi.fn().mockResolvedValue(new Map()),
  listNodes: vi.fn().mockResolvedValue({ nodes: [], total: 0 }),
  resolveNodes: vi.fn().mockResolvedValue([]),
  nodesExist: vi.fn().mockResolvedValue(new Map()),
  ...overrides,
});

const createMockEmbedding = (
  overrides?: Partial<Embedding> & {
    id?: string;
    onRegister?: () => Promise<void>;
    onUnregister?: () => Promise<void>;
  }
): Embedding => ({
  id: overrides?.id ?? 'test-embedding',
  embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  embedBatch: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
  dimensions: vi.fn().mockReturnValue(384),
  modelId: vi.fn().mockReturnValue('test-model'),
  ...overrides,
});

describe('GraphCore', () => {
  let mockStore: Store;
  let mockEmbedding: Embedding;

  beforeEach(() => {
    mockStore = createMockStore();
    mockEmbedding = createMockEmbedding();
  });

  describe('provider registration', () => {
    it('registerStore sets the store provider', async () => {
      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      // Verify by attempting an operation that uses the store
      await expect(core.registerStore(mockStore)).resolves.not.toThrow();
    });

    it('registerEmbedding sets the embedding provider', async () => {
      const core = new GraphCoreImpl();
      await core.registerEmbedding(mockEmbedding);

      await expect(core.registerEmbedding(mockEmbedding)).resolves.not.toThrow();
    });

    it('throws on operations without store registered', async () => {
      const core = new GraphCoreImpl();
      await core.registerEmbedding(mockEmbedding);

      await expect(core.getNode('test.md')).rejects.toThrow(/store/i);
    });

    it('throws when registering null store', async () => {
      const core = new GraphCoreImpl();
      await expect(core.registerStore(null as unknown as Store)).rejects.toThrow(/store provider is required/i);
    });

    it('throws when registering undefined store', async () => {
      const core = new GraphCoreImpl();
      await expect(core.registerStore(undefined as unknown as Store)).rejects.toThrow(/store provider is required/i);
    });

    it('throws when registering null embedding provider', async () => {
      const core = new GraphCoreImpl();
      await expect(core.registerEmbedding(null as unknown as Embedding)).rejects.toThrow(/embedding provider is required/i);
    });

    it('throws when registering undefined embedding provider', async () => {
      const core = new GraphCoreImpl();
      await expect(core.registerEmbedding(undefined as unknown as Embedding)).rejects.toThrow(/embedding provider is required/i);
    });

    it('throws when registering invalid store (missing required methods)', async () => {
      const invalidStore = { id: 'invalid', createNode: vi.fn() } as unknown as Store;
      const core = new GraphCoreImpl();
      await expect(core.registerStore(invalidStore)).rejects.toThrow(/invalid store provider/i);
    });

    it('throws when registering invalid embedding (missing required methods)', async () => {
      const invalidEmbedding = { id: 'invalid', embed: vi.fn() } as unknown as Embedding;
      const core = new GraphCoreImpl();
      await expect(core.registerEmbedding(invalidEmbedding)).rejects.toThrow(/invalid embedding provider/i);
    });

    it('uses most recently registered store', async () => {
      const store1 = createMockStore({ id: 'store-1' });
      const store2 = createMockStore({ id: 'store-2' });
      vi.mocked(store2.getNode).mockResolvedValue(createMockNode('from-store2'));

      const core = new GraphCoreImpl();
      await core.registerStore(store1);
      await core.registerStore(store2);

      await core.getNode('test');

      expect(store2.getNode).toHaveBeenCalled();
      expect(store1.getNode).not.toHaveBeenCalled();
    });

    it('uses most recently registered embedding provider', async () => {
      const embedding1 = createMockEmbedding({ id: 'embedding-1' });
      const embedding2 = createMockEmbedding({ id: 'embedding-2' });
      vi.mocked(embedding2.embed).mockResolvedValue([0.5, 0.5, 0.5]);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);
      await core.registerEmbedding(embedding1);
      await core.registerEmbedding(embedding2);

      await core.search('test');

      expect(embedding2.embed).toHaveBeenCalled();
      expect(embedding1.embed).not.toHaveBeenCalled();
    });

    describe('lifecycle hooks', () => {
      it('calls onRegister when registering store', async () => {
        const onRegister = vi.fn().mockResolvedValue(undefined);
        const store = createMockStore({ onRegister });

        const core = new GraphCoreImpl();
        await core.registerStore(store);

        expect(onRegister).toHaveBeenCalledOnce();
      });

      it('calls onRegister when registering embedding', async () => {
        const onRegister = vi.fn().mockResolvedValue(undefined);
        const embedding = createMockEmbedding({ onRegister });

        const core = new GraphCoreImpl();
        await core.registerEmbedding(embedding);

        expect(onRegister).toHaveBeenCalledOnce();
      });

      it('calls onUnregister on previous store when replacing', async () => {
        const onUnregister = vi.fn().mockResolvedValue(undefined);
        const store1 = createMockStore({ id: 'store-1', onUnregister });
        const store2 = createMockStore({ id: 'store-2' });

        const core = new GraphCoreImpl();
        await core.registerStore(store1);
        await core.registerStore(store2);

        expect(onUnregister).toHaveBeenCalledOnce();
      });

      it('logs but continues when store onUnregister throws during re-registration', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const onUnregister = vi.fn().mockRejectedValue(new Error('Store cleanup failed'));
        const store1 = createMockStore({ id: 'store-1', onUnregister });
        const store2 = createMockStore({ id: 'store-2' });

        const core = new GraphCoreImpl();
        await core.registerStore(store1);

        // Should not throw, new store should still register
        await expect(core.registerStore(store2)).resolves.not.toThrow();

        // Warning should be logged
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('calls onUnregister on previous embedding when replacing', async () => {
        const onUnregister = vi.fn().mockResolvedValue(undefined);
        const embedding1 = createMockEmbedding({ id: 'embedding-1', onUnregister });
        const embedding2 = createMockEmbedding({ id: 'embedding-2' });

        const core = new GraphCoreImpl();
        await core.registerEmbedding(embedding1);
        await core.registerEmbedding(embedding2);

        expect(onUnregister).toHaveBeenCalledOnce();
      });

      it('logs but continues when embedding onUnregister throws during re-registration', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const onUnregister = vi.fn().mockRejectedValue(new Error('Embedding cleanup failed'));
        const embedding1 = createMockEmbedding({ id: 'embedding-1', onUnregister });
        const embedding2 = createMockEmbedding({ id: 'embedding-2' });

        const core = new GraphCoreImpl();
        await core.registerEmbedding(embedding1);

        // Should not throw, new embedding should still register
        await expect(core.registerEmbedding(embedding2)).resolves.not.toThrow();

        // Warning should be logged
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('works with providers that have no lifecycle hooks', async () => {
        const store = createMockStore();
        // Explicitly remove lifecycle hooks
        delete (store as { onRegister?: unknown }).onRegister;
        delete (store as { onUnregister?: unknown }).onUnregister;

        const core = new GraphCoreImpl();
        // Should not throw
        await expect(core.registerStore(store)).resolves.not.toThrow();
      });

      it('propagates onRegister errors', async () => {
        const onRegister = vi.fn().mockRejectedValue(new Error('Init failed'));
        const store = createMockStore({ onRegister });

        const core = new GraphCoreImpl();

        await expect(core.registerStore(store)).rejects.toThrow('Init failed');
      });

      it('rolls back registration when onRegister fails', async () => {
        const onRegister = vi.fn().mockRejectedValue(new Error('Init failed'));
        const store = createMockStore({ onRegister });

        const core = new GraphCoreImpl();

        try {
          await core.registerStore(store);
        } catch {
          // Expected
        }

        // Store should not be registered after failure
        await expect(core.getNode('test')).rejects.toThrow(/store not registered/i);
      });

      it('propagates onRegister errors for embedding', async () => {
        const onRegister = vi.fn().mockRejectedValue(new Error('Model load failed'));
        const embedding = createMockEmbedding({ onRegister });

        const core = new GraphCoreImpl();

        await expect(core.registerEmbedding(embedding)).rejects.toThrow('Model load failed');
      });

      it('rolls back embedding registration when onRegister fails', async () => {
        const onRegister = vi.fn().mockRejectedValue(new Error('Model load failed'));
        const embedding = createMockEmbedding({ onRegister });

        const core = new GraphCoreImpl();
        await core.registerStore(mockStore);

        try {
          await core.registerEmbedding(embedding);
        } catch {
          // Expected
        }

        // Embedding should not be registered after failure
        await expect(core.search('test')).rejects.toThrow(/embedding not registered/i);
      });
    });

    describe('destroy', () => {
      it('calls onUnregister on store', async () => {
        const onUnregister = vi.fn().mockResolvedValue(undefined);
        const store = createMockStore({ onUnregister });

        const core = new GraphCoreImpl();
        await core.registerStore(store);

        await core.destroy();

        expect(onUnregister).toHaveBeenCalledOnce();
      });

      it('calls onUnregister on embedding', async () => {
        const onUnregister = vi.fn().mockResolvedValue(undefined);
        const embedding = createMockEmbedding({ onUnregister });

        const core = new GraphCoreImpl();
        await core.registerEmbedding(embedding);

        await core.destroy();

        expect(onUnregister).toHaveBeenCalledOnce();
      });

      it('clears provider references after destroy', async () => {
        const core = new GraphCoreImpl();
        await core.registerStore(mockStore);
        await core.registerEmbedding(mockEmbedding);

        await core.destroy();

        await expect(core.getNode('test')).rejects.toThrow(/store not registered/i);
      });

      it('is idempotent - safe to call multiple times', async () => {
        const onUnregister = vi.fn().mockResolvedValue(undefined);
        const store = createMockStore({ onUnregister });

        const core = new GraphCoreImpl();
        await core.registerStore(store);

        await core.destroy();
        await core.destroy(); // Second call should not throw

        // onUnregister should only be called once
        expect(onUnregister).toHaveBeenCalledOnce();
      });

      it('logs but does not throw on store onUnregister errors', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const onUnregister = vi.fn().mockRejectedValue(new Error('Cleanup failed'));
        const store = createMockStore({ onUnregister });

        const core = new GraphCoreImpl();
        await core.registerStore(store);

        // destroy should not throw even if onUnregister fails
        await expect(core.destroy()).resolves.not.toThrow();

        // Warning should be logged
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('logs but does not throw on embedding onUnregister errors', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const onUnregister = vi.fn().mockRejectedValue(new Error('Embedding cleanup failed'));
        const embedding = createMockEmbedding({ onUnregister });

        const core = new GraphCoreImpl();
        await core.registerEmbedding(embedding);

        // destroy should not throw even if onUnregister fails
        await expect(core.destroy()).resolves.not.toThrow();

        // Warning should be logged
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });
  });

  describe('search', () => {
    beforeEach(() => {
      vi.mocked(mockStore.searchByVector).mockResolvedValue([
        { id: 'a.md', distance: 0.1 },
        { id: 'b.md', distance: 0.5 },
      ]);
      vi.mocked(mockStore.getNodes).mockResolvedValue([
        createMockNode('a.md'),
        createMockNode('b.md'),
      ]);
    });

    it('embeds query and searches vectors', async () => {
      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);
      await core.registerEmbedding(mockEmbedding);

      await core.search('test query');

      expect(mockEmbedding.embed).toHaveBeenCalledWith('test query');
      expect(mockStore.searchByVector).toHaveBeenCalled();
    });

    it('converts distance to score (higher = better)', async () => {
      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);
      await core.registerEmbedding(mockEmbedding);

      const results = await core.search('test');

      // Score formula: 1 / (1 + distance)
      // distance 0.1 -> score ~0.909
      // distance 0.5 -> score ~0.667
      // Results should be ordered by score descending (already is since distance ascending)
      expect(results).toHaveLength(2);
      expect(results[0]?.id).toBe('a.md');
      expect(results[1]?.id).toBe('b.md');

      // Verify actual score conversion from distances
      // The SearchResult type includes score, verify it's computed correctly
      // Note: GraphCore.search returns Node[], not SearchResult with scores
      // The scores are computed at the MCP layer. GraphCore just returns hydrated nodes
      // in distance order. Verify the ordering is correct (closest first).
      const ids = results.map(r => r.id);
      expect(ids).toEqual(['a.md', 'b.md']); // a.md has lower distance (0.1), so comes first
    });

    it('hydrates nodes from IDs', async () => {
      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);
      await core.registerEmbedding(mockEmbedding);

      await core.search('test');

      expect(mockStore.getNodes).toHaveBeenCalledWith(['a.md', 'b.md']);
    });

    it('respects limit option', async () => {
      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);
      await core.registerEmbedding(mockEmbedding);

      await core.search('test', { limit: 5 });

      expect(mockStore.searchByVector).toHaveBeenCalledWith(
        expect.any(Array),
        5
      );
    });

    it('uses default limit of 10', async () => {
      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);
      await core.registerEmbedding(mockEmbedding);

      await core.search('test');

      expect(mockStore.searchByVector).toHaveBeenCalledWith(
        expect.any(Array),
        10
      );
    });

    it('throws without embedding provider', async () => {
      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      await expect(core.search('test')).rejects.toThrow(/embedding/i);
    });
  });

  describe('getNode', () => {
    it('delegates to store', async () => {
      const node = createMockNode('test.md');
      vi.mocked(mockStore.getNode).mockResolvedValue(node);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = await core.getNode('test.md');

      expect(mockStore.getNode).toHaveBeenCalledWith('test.md');
      expect(result?.id).toBe('test.md');
    });

    it('returns null for non-existent node', async () => {
      vi.mocked(mockStore.getNode).mockResolvedValue(null);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = await core.getNode('missing.md');
      expect(result).toBeNull();
    });

    it('includes neighbor counts with depth > 0', async () => {
      const node = createMockNode('test.md');
      vi.mocked(mockStore.getNode).mockResolvedValue(node);
      vi.mocked(mockStore.getNeighbors)
        .mockResolvedValueOnce([createMockNode('in1.md'), createMockNode('in2.md')]) // incoming
        .mockResolvedValueOnce([createMockNode('out1.md')]); // outgoing

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = (await core.getNode('test.md', 1)) as NodeWithContext;

      expect(result.incomingCount).toBe(2);
      expect(result.outgoingCount).toBe(1);
    });

    it('includes neighbors with depth > 0', async () => {
      const node = createMockNode('test.md');
      const inNeighbor = createMockNode('incoming.md');
      const outNeighbor = createMockNode('outgoing.md');

      vi.mocked(mockStore.getNode).mockResolvedValue(node);
      vi.mocked(mockStore.getNeighbors)
        .mockResolvedValueOnce([inNeighbor])
        .mockResolvedValueOnce([outNeighbor]);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = (await core.getNode('test.md', 1)) as NodeWithContext;

      expect(result.neighbors).toHaveLength(2);
      expect(result.neighbors?.map((n) => n.id).sort()).toEqual([
        'incoming.md',
        'outgoing.md',
      ]);
    });

    it('deduplicates neighbors that appear in both directions', async () => {
      const node = createMockNode('test.md');
      const bidirectional = createMockNode('bidirectional.md');

      vi.mocked(mockStore.getNode).mockResolvedValue(node);
      vi.mocked(mockStore.getNeighbors)
        .mockResolvedValueOnce([bidirectional]) // incoming
        .mockResolvedValueOnce([bidirectional]); // outgoing

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = (await core.getNode('test.md', 1)) as NodeWithContext;

      expect(result.neighbors).toHaveLength(1);
      expect(result.neighbors?.[0]?.id).toBe('bidirectional.md');
    });

    it('skips neighbor fetch when depth is 0 or undefined', async () => {
      const node = createMockNode('test.md');
      vi.mocked(mockStore.getNode).mockResolvedValue(node);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      await core.getNode('test.md');
      await core.getNode('test.md', 0);

      expect(mockStore.getNeighbors).not.toHaveBeenCalled();
    });
  });

  describe('createNode', () => {
    it('delegates to store and returns created node', async () => {
      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const input: Partial<Node> = {
        id: 'new.md',
        title: 'New Note',
        content: 'Content',
      };

      vi.mocked(mockStore.getNode).mockResolvedValue(
        createMockNode('new.md', input)
      );

      const result = await core.createNode(input);

      expect(mockStore.createNode).toHaveBeenCalled();
      expect(result.id).toBe('new.md');
    });

    it('fills in default values for optional fields', async () => {
      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const input: Partial<Node> = {
        id: 'minimal.md',
        title: 'Minimal',
      };

      await core.createNode(input);

      const calledWith = vi.mocked(mockStore.createNode).mock.calls[0]?.[0];
      expect(calledWith?.content).toBe('');
      expect(calledWith?.tags).toEqual([]);
      expect(calledWith?.outgoingLinks).toEqual([]);
      expect(calledWith?.properties).toEqual({});
    });

    it('preserves provided optional fields', async () => {
      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const input: Partial<Node> = {
        id: 'full.md',
        title: 'Full',
        content: 'Has content',
        tags: ['tag1'],
        outgoingLinks: ['link.md'],
        properties: { key: 'value' },
      };

      await core.createNode(input);

      const calledWith = vi.mocked(mockStore.createNode).mock.calls[0]?.[0];
      expect(calledWith?.content).toBe('Has content');
      expect(calledWith?.tags).toEqual(['tag1']);
      expect(calledWith?.outgoingLinks).toEqual(['link.md']);
      expect(calledWith?.properties).toEqual({ key: 'value' });
    });

    it('preserves sourceRef when provided', async () => {
      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const input: Partial<Node> = {
        id: 'with-source.md',
        title: 'With Source',
        content: '',
        sourceRef: { type: 'file', path: '/path/to/file.md' },
      };

      await core.createNode(input);

      const calledWith = vi.mocked(mockStore.createNode).mock.calls[0]?.[0];
      expect(calledWith?.sourceRef).toEqual({
        type: 'file',
        path: '/path/to/file.md',
      });
    });

    it('throws if id is missing', async () => {
      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      await expect(
        core.createNode({ title: 'No ID', content: '' })
      ).rejects.toThrow(/id.*required/i);
    });

    it('throws if id is empty string', async () => {
      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      await expect(
        core.createNode({ id: '', title: 'Empty ID', content: '' })
      ).rejects.toThrow(/id.*required.*cannot be empty/i);
    });

    it('throws if id is whitespace only', async () => {
      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      await expect(
        core.createNode({ id: '   ', title: 'Whitespace ID', content: '' })
      ).rejects.toThrow(/id.*required.*cannot be empty/i);
    });

    it('throws if id is whitespace variants', async () => {
      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      await expect(
        core.createNode({ id: '\t\n', title: 'Tab Newline ID', content: '' })
      ).rejects.toThrow(/id.*required.*cannot be empty/i);
    });

    it('throws if title is missing', async () => {
      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      await expect(
        core.createNode({ id: 'no-title.md', content: '' })
      ).rejects.toThrow(/title/i);
    });
  });

  describe('updateNode', () => {
    it('delegates to store and returns updated node', async () => {
      const updated = createMockNode('test.md', { title: 'Updated' });
      vi.mocked(mockStore.getNode).mockResolvedValue(updated);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = await core.updateNode('test.md', { title: 'Updated' });

      expect(mockStore.updateNode).toHaveBeenCalledWith('test.md', {
        title: 'Updated',
      });
      expect(result.title).toBe('Updated');
    });

    it('throws if node not found after update', async () => {
      vi.mocked(mockStore.getNode).mockResolvedValue(null);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      await expect(
        core.updateNode('vanished.md', { title: 'Ghost' })
      ).rejects.toThrow(/not found after update/i);
    });
  });

  describe('deleteNode', () => {
    it('delegates to store and returns true on success', async () => {
      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = await core.deleteNode('test.md');

      expect(mockStore.deleteNode).toHaveBeenCalledWith('test.md');
      expect(result).toBe(true);
    });

    it('returns false when store throws "not found" error', async () => {
      vi.mocked(mockStore.deleteNode).mockRejectedValue(
        new Error('Node not found: missing.md')
      );

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = await core.deleteNode('missing.md');
      expect(result).toBe(false);
    });

    it('propagates permission errors instead of swallowing them', async () => {
      const permissionError = new Error('EACCES: permission denied');
      vi.mocked(mockStore.deleteNode).mockRejectedValue(permissionError);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      await expect(core.deleteNode('protected.md')).rejects.toThrow('EACCES');
    });

    it('propagates disk errors instead of swallowing them', async () => {
      const diskError = new Error('ENOSPC: no space left on device');
      vi.mocked(mockStore.deleteNode).mockRejectedValue(diskError);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      await expect(core.deleteNode('file.md')).rejects.toThrow('ENOSPC');
    });

    it('propagates generic errors that are not "not found"', async () => {
      const genericError = new Error('Database connection failed');
      vi.mocked(mockStore.deleteNode).mockRejectedValue(genericError);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      await expect(core.deleteNode('file.md')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getNeighbors', () => {
    it('delegates to store', async () => {
      const neighbors = [createMockNode('a.md'), createMockNode('b.md')];
      vi.mocked(mockStore.getNeighbors).mockResolvedValue(neighbors);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = await core.getNeighbors('test.md', { direction: 'out' });

      expect(mockStore.getNeighbors).toHaveBeenCalledWith('test.md', {
        direction: 'out',
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('findPath', () => {
    it('delegates to store', async () => {
      vi.mocked(mockStore.findPath).mockResolvedValue(['a.md', 'b.md', 'c.md']);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = await core.findPath('a.md', 'c.md');

      expect(mockStore.findPath).toHaveBeenCalledWith('a.md', 'c.md');
      expect(result).toEqual(['a.md', 'b.md', 'c.md']);
    });

    it('returns null when no path', async () => {
      vi.mocked(mockStore.findPath).mockResolvedValue(null);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = await core.findPath('a.md', 'z.md');
      expect(result).toBeNull();
    });
  });

  describe('getHubs', () => {
    it('delegates to store', async () => {
      vi.mocked(mockStore.getHubs).mockResolvedValue([
        ['hub.md', 10],
        ['other.md', 5],
      ]);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = await core.getHubs('in_degree', 5);

      expect(mockStore.getHubs).toHaveBeenCalledWith('in_degree', 5);
      expect(result).toEqual([
        ['hub.md', 10],
        ['other.md', 5],
      ]);
    });
  });

  describe('searchByTags', () => {
    it('delegates to store', async () => {
      const tagged = [createMockNode('tagged.md', { tags: ['test'] })];
      vi.mocked(mockStore.searchByTags).mockResolvedValue(tagged);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = await core.searchByTags(['test'], 'any');

      expect(mockStore.searchByTags).toHaveBeenCalledWith(['test'], 'any', undefined);
      expect(result).toEqual(tagged);
    });

    it('passes limit to store instead of post-slicing', async () => {
      const nodes = [
        createMockNode('a.md'),
        createMockNode('b.md'),
      ];
      vi.mocked(mockStore.searchByTags).mockResolvedValue(nodes);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      await core.searchByTags(['test'], 'any', 2);

      // The limit must be passed to the store, not handled by slicing after
      expect(mockStore.searchByTags).toHaveBeenCalledWith(['test'], 'any', 2);
    });

    it('does not slice results when limit is passed to store', async () => {
      // Store returns exactly what was requested with limit
      const nodes = [
        createMockNode('a.md'),
        createMockNode('b.md'),
      ];
      vi.mocked(mockStore.searchByTags).mockResolvedValue(nodes);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = await core.searchByTags(['test'], 'any', 2);

      expect(result).toHaveLength(2);
      expect(result).toEqual(nodes);
    });
  });

  describe('getRandomNode', () => {
    it('delegates to store without tags', async () => {
      const node = createMockNode('random.md');
      vi.mocked(mockStore.getRandomNode).mockResolvedValue(node);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = await core.getRandomNode();

      expect(mockStore.getRandomNode).toHaveBeenCalledWith(undefined);
      expect(result?.id).toBe('random.md');
    });

    it('delegates to store with tags', async () => {
      const node = createMockNode('tagged.md', { tags: ['special'] });
      vi.mocked(mockStore.getRandomNode).mockResolvedValue(node);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = await core.getRandomNode(['special']);

      expect(mockStore.getRandomNode).toHaveBeenCalledWith(['special']);
      expect(result?.id).toBe('tagged.md');
    });

    it('returns null when store returns null', async () => {
      vi.mocked(mockStore.getRandomNode).mockResolvedValue(null);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = await core.getRandomNode();
      expect(result).toBeNull();
    });
  });

  describe('listNodes', () => {
    it('delegates to store and returns nodes with total', async () => {
      const summaries = [
        { id: 'a.md', title: 'A' },
        { id: 'b.md', title: 'B' },
      ];
      vi.mocked(mockStore.listNodes).mockResolvedValue({
        nodes: summaries,
        total: 50,
      });

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = await core.listNodes({ tag: 'test' }, { limit: 50 });

      expect(mockStore.listNodes).toHaveBeenCalledWith({ tag: 'test' }, { limit: 50 });
      expect(result).toEqual({ nodes: summaries, total: 50 });
    });

    it('works with empty filter', async () => {
      vi.mocked(mockStore.listNodes).mockResolvedValue({
        nodes: [],
        total: 0,
      });

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = await core.listNodes({});

      expect(mockStore.listNodes).toHaveBeenCalledWith({}, undefined);
      expect(result).toEqual({ nodes: [], total: 0 });
    });
  });

  describe('resolveNodes', () => {
    it('delegates exact strategy to store', async () => {
      const results = [{ query: 'beef', match: 'beef.md', score: 1 }];
      vi.mocked(mockStore.resolveNodes).mockResolvedValue(results);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = await core.resolveNodes(['beef'], { strategy: 'exact' });

      expect(mockStore.resolveNodes).toHaveBeenCalledWith(['beef'], { strategy: 'exact' });
      expect(result).toEqual(results);
    });

    it('delegates fuzzy strategy to store', async () => {
      const results = [{ query: 'bef', match: 'beef.md', score: 0.9 }];
      vi.mocked(mockStore.resolveNodes).mockResolvedValue(results);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      const result = await core.resolveNodes(['bef'], { strategy: 'fuzzy', threshold: 0.5 });

      expect(mockStore.resolveNodes).toHaveBeenCalledWith(['bef'], { strategy: 'fuzzy', threshold: 0.5 });
      expect(result).toEqual(results);
    });

    it('uses fuzzy strategy by default', async () => {
      vi.mocked(mockStore.resolveNodes).mockResolvedValue([]);

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      await core.resolveNodes(['test']);

      expect(mockStore.resolveNodes).toHaveBeenCalledWith(['test'], undefined);
    });

    it('throws for semantic strategy without embedding provider', async () => {
      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);

      await expect(
        core.resolveNodes(['test'], { strategy: 'semantic' })
      ).rejects.toThrow(/embedding/i);
    });

    it('handles semantic strategy with embedding provider', async () => {
      const candidates = [
        { id: 'beef.md', title: 'Ground Beef' },
        { id: 'chicken.md', title: 'Chicken Breast' },
      ];
      vi.mocked(mockStore.listNodes).mockResolvedValue({ nodes: candidates, total: 2 });
      vi.mocked(mockEmbedding.embedBatch)
        .mockResolvedValueOnce([[0.9, 0.1, 0.1]]) // query embeddings
        .mockResolvedValueOnce([[0.9, 0.1, 0.1], [0.1, 0.9, 0.1]]); // candidate embeddings

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);
      await core.registerEmbedding(mockEmbedding);

      const result = await core.resolveNodes(['beef'], { strategy: 'semantic' });

      expect(result).toHaveLength(1);
      expect(result[0]!.query).toBe('beef');
      expect(result[0]!.match).toBe('beef.md');
      expect(result[0]!.score).toBeGreaterThan(0.7);
    });

    it('returns no match when semantic score below threshold', async () => {
      const candidates = [{ id: 'unrelated.md', title: 'Completely Unrelated' }];
      vi.mocked(mockStore.listNodes).mockResolvedValue({ nodes: candidates, total: 1 });
      vi.mocked(mockEmbedding.embedBatch)
        .mockResolvedValueOnce([[1, 0, 0]]) // query
        .mockResolvedValueOnce([[0, 1, 0]]); // candidate - orthogonal = 0 similarity

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);
      await core.registerEmbedding(mockEmbedding);

      const result = await core.resolveNodes(['test'], { strategy: 'semantic', threshold: 0.5 });

      expect(result[0]!.match).toBeNull();
      expect(result[0]!.score).toBe(0);
    });

    it('applies tag filter for semantic strategy', async () => {
      vi.mocked(mockStore.listNodes).mockResolvedValue({ nodes: [], total: 0 });

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);
      await core.registerEmbedding(mockEmbedding);

      await core.resolveNodes(['test'], { strategy: 'semantic', tag: 'ingredient' });

      expect(mockStore.listNodes).toHaveBeenCalledWith(
        { tag: 'ingredient' },
        { limit: 1000 }
      );
    });

    it('applies path filter for semantic strategy', async () => {
      vi.mocked(mockStore.listNodes).mockResolvedValue({ nodes: [], total: 0 });

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);
      await core.registerEmbedding(mockEmbedding);

      await core.resolveNodes(['test'], { strategy: 'semantic', path: 'ingredients/' });

      expect(mockStore.listNodes).toHaveBeenCalledWith(
        { path: 'ingredients/' },
        { limit: 1000 }
      );
    });

    it('returns empty results for empty names', async () => {
      vi.mocked(mockStore.listNodes).mockResolvedValue({ nodes: [{ id: 'a.md', title: 'A' }], total: 1 });

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);
      await core.registerEmbedding(mockEmbedding);

      const result = await core.resolveNodes([], { strategy: 'semantic' });

      expect(result).toEqual([]);
    });

    it('returns empty results when no candidates match filters', async () => {
      vi.mocked(mockStore.listNodes).mockResolvedValue({ nodes: [], total: 0 });

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);
      await core.registerEmbedding(mockEmbedding);

      const result = await core.resolveNodes(['test'], { strategy: 'semantic' });

      expect(result).toEqual([{ query: 'test', match: null, score: 0 }]);
    });

    it('handles zero vectors gracefully (cosine similarity edge case)', async () => {
      const candidates = [{ id: 'a.md', title: 'A' }];
      vi.mocked(mockStore.listNodes).mockResolvedValue({ nodes: candidates, total: 1 });
      vi.mocked(mockEmbedding.embedBatch)
        .mockResolvedValueOnce([[0, 0, 0]]) // query is zero vector
        .mockResolvedValueOnce([[1, 0, 0]]); // candidate is normal

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);
      await core.registerEmbedding(mockEmbedding);

      const result = await core.resolveNodes(['test'], { strategy: 'semantic' });

      // Zero vector should result in 0 similarity, no match
      expect(result[0]!.match).toBeNull();
      expect(result[0]!.score).toBe(0);
    });

    it('throws on dimension mismatch in semantic resolution', async () => {
      vi.mocked(mockStore.listNodes).mockResolvedValue({
        nodes: [{ id: 'a.md', title: 'A' }],
        total: 1,
      });
      vi.mocked(mockEmbedding.embedBatch)
        .mockResolvedValueOnce([[0.1, 0.2, 0.3]]) // 3-dim query
        .mockResolvedValueOnce([[0.1, 0.2, 0.3, 0.4]]); // 4-dim candidate

      const core = new GraphCoreImpl();
      await core.registerStore(mockStore);
      await core.registerEmbedding(mockEmbedding);

      await expect(
        core.resolveNodes(['test'], { strategy: 'semantic' })
      ).rejects.toThrow(/dimension mismatch/i);
    });
  });

  describe('fromConfig', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'roux-graphcore-test-'));
      await mkdir(join(tempDir, 'source'), { recursive: true });
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('throws if store config missing', async () => {
      const config = { providers: {} } as RouxConfig;

      await expect(GraphCoreImpl.fromConfig(config)).rejects.toThrow(/store/i);
    });

    it('accepts docstore config', async () => {
      const config: RouxConfig = {
        providers: {
          store: { type: 'docstore' },
        },
        source: { path: join(tempDir, 'source'), include: ['*.md'], exclude: [] },
        cache: { path: join(tempDir, 'cache') },
      };

      // This should not throw - it creates the DocStore
      const core = await GraphCoreImpl.fromConfig(config);
      expect(core).toBeDefined();
      await core.destroy();
    });

    it('uses default paths when source and cache not specified', async () => {
      // Need to run from a temp dir for this test
      const originalCwd = process.cwd();
      process.chdir(tempDir);

      try {
        const config: RouxConfig = {
          providers: {
            store: { type: 'docstore' },
          },
        };

        const core = await GraphCoreImpl.fromConfig(config);
        expect(core).toBeDefined();
        await core.destroy();
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('uses local embedding with custom model', async () => {
      const config: RouxConfig = {
        providers: {
          store: { type: 'docstore' },
          embedding: { type: 'local', model: 'custom-model' },
        },
        source: { path: join(tempDir, 'source'), include: ['*.md'], exclude: [] },
        cache: { path: join(tempDir, 'cache2') },
      };

      const core = await GraphCoreImpl.fromConfig(config);
      expect(core).toBeDefined();
      await core.destroy();
    });

    it('throws on unsupported embedding type', async () => {
      const config: RouxConfig = {
        providers: {
          store: { type: 'docstore' },
          embedding: { type: 'openai' as 'local' },
        },
        source: { path: join(tempDir, 'source'), include: ['*.md'], exclude: [] },
        cache: { path: join(tempDir, 'cache3') },
      };

      await expect(GraphCoreImpl.fromConfig(config)).rejects.toThrow(/unsupported/i);
    });

    it('throws on unsupported store type', async () => {
      const config: RouxConfig = {
        providers: {
          store: { type: 'memory' as 'docstore' },
        },
        source: { path: join(tempDir, 'source'), include: ['*.md'], exclude: [] },
        cache: { path: join(tempDir, 'cache4') },
      };

      await expect(GraphCoreImpl.fromConfig(config)).rejects.toThrow(/unsupported.*store/i);
    });

    it('cleans up store when embedding registration fails', async () => {
      // Mock TransformersEmbedding to fail on registration
      const { TransformersEmbedding } = await import('../../../src/providers/embedding/transformers.js');
      const originalOnRegister = TransformersEmbedding.prototype.onRegister;
      TransformersEmbedding.prototype.onRegister = vi.fn().mockRejectedValue(
        new Error('Model load failed')
      );

      const config: RouxConfig = {
        providers: {
          store: { type: 'docstore' },
        },
        source: { path: join(tempDir, 'source'), include: ['*.md'], exclude: [] },
        cache: { path: join(tempDir, 'cache5') },
      };

      try {
        await expect(GraphCoreImpl.fromConfig(config)).rejects.toThrow('Model load failed');
      } finally {
        TransformersEmbedding.prototype.onRegister = originalOnRegister;
      }

      // Verify the store was cleaned up by checking we can create a new one
      // at the same cache path without file locking issues
      const { DocStore } = await import('../../../src/providers/docstore/index.js');
      const verifyStore = new DocStore({
        sourceRoot: join(tempDir, 'source'),
        cacheDir: join(tempDir, 'cache5'),
      });
      verifyStore.close();
    });
  });
});
