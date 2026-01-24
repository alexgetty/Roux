import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GraphCoreImpl } from '../../../src/core/graphcore.js';
import type { GraphCore } from '../../../src/types/graphcore.js';
import type {
  StoreProvider,
  EmbeddingProvider,
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
  overrides?: Partial<StoreProvider>
): StoreProvider => ({
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
  ...overrides,
});

const createMockEmbedding = (
  overrides?: Partial<EmbeddingProvider>
): EmbeddingProvider => ({
  embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  embedBatch: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
  dimensions: vi.fn().mockReturnValue(384),
  modelId: vi.fn().mockReturnValue('test-model'),
  ...overrides,
});

describe('GraphCore', () => {
  let mockStore: StoreProvider;
  let mockEmbedding: EmbeddingProvider;

  beforeEach(() => {
    mockStore = createMockStore();
    mockEmbedding = createMockEmbedding();
  });

  describe('provider registration', () => {
    it('registerStore sets the store provider', () => {
      const core = new GraphCoreImpl();
      core.registerStore(mockStore);

      // Verify by attempting an operation that uses the store
      expect(() => core.registerStore(mockStore)).not.toThrow();
    });

    it('registerEmbedding sets the embedding provider', () => {
      const core = new GraphCoreImpl();
      core.registerEmbedding(mockEmbedding);

      expect(() => core.registerEmbedding(mockEmbedding)).not.toThrow();
    });

    it('throws on operations without store registered', async () => {
      const core = new GraphCoreImpl();
      core.registerEmbedding(mockEmbedding);

      await expect(core.getNode('test.md')).rejects.toThrow(/store/i);
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
      core.registerStore(mockStore);
      core.registerEmbedding(mockEmbedding);

      await core.search('test query');

      expect(mockEmbedding.embed).toHaveBeenCalledWith('test query');
      expect(mockStore.searchByVector).toHaveBeenCalled();
    });

    it('converts distance to score (higher = better)', async () => {
      const core = new GraphCoreImpl();
      core.registerStore(mockStore);
      core.registerEmbedding(mockEmbedding);

      const results = await core.search('test');

      // Score formula: 1 / (1 + distance)
      // distance 0.1 -> score ~0.909
      // distance 0.5 -> score ~0.667
      // Results should be ordered by score descending (already is since distance ascending)
      expect(results).toHaveLength(2);
      expect(results[0]?.id).toBe('a.md');
    });

    it('hydrates nodes from IDs', async () => {
      const core = new GraphCoreImpl();
      core.registerStore(mockStore);
      core.registerEmbedding(mockEmbedding);

      await core.search('test');

      expect(mockStore.getNodes).toHaveBeenCalledWith(['a.md', 'b.md']);
    });

    it('respects limit option', async () => {
      const core = new GraphCoreImpl();
      core.registerStore(mockStore);
      core.registerEmbedding(mockEmbedding);

      await core.search('test', { limit: 5 });

      expect(mockStore.searchByVector).toHaveBeenCalledWith(
        expect.any(Array),
        5
      );
    });

    it('uses default limit of 10', async () => {
      const core = new GraphCoreImpl();
      core.registerStore(mockStore);
      core.registerEmbedding(mockEmbedding);

      await core.search('test');

      expect(mockStore.searchByVector).toHaveBeenCalledWith(
        expect.any(Array),
        10
      );
    });

    it('throws without embedding provider', async () => {
      const core = new GraphCoreImpl();
      core.registerStore(mockStore);

      await expect(core.search('test')).rejects.toThrow(/embedding/i);
    });
  });

  describe('getNode', () => {
    it('delegates to store', async () => {
      const node = createMockNode('test.md');
      vi.mocked(mockStore.getNode).mockResolvedValue(node);

      const core = new GraphCoreImpl();
      core.registerStore(mockStore);

      const result = await core.getNode('test.md');

      expect(mockStore.getNode).toHaveBeenCalledWith('test.md');
      expect(result?.id).toBe('test.md');
    });

    it('returns null for non-existent node', async () => {
      vi.mocked(mockStore.getNode).mockResolvedValue(null);

      const core = new GraphCoreImpl();
      core.registerStore(mockStore);

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
      core.registerStore(mockStore);

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
      core.registerStore(mockStore);

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
      core.registerStore(mockStore);

      const result = (await core.getNode('test.md', 1)) as NodeWithContext;

      expect(result.neighbors).toHaveLength(1);
      expect(result.neighbors?.[0]?.id).toBe('bidirectional.md');
    });

    it('skips neighbor fetch when depth is 0 or undefined', async () => {
      const node = createMockNode('test.md');
      vi.mocked(mockStore.getNode).mockResolvedValue(node);

      const core = new GraphCoreImpl();
      core.registerStore(mockStore);

      await core.getNode('test.md');
      await core.getNode('test.md', 0);

      expect(mockStore.getNeighbors).not.toHaveBeenCalled();
    });
  });

  describe('createNode', () => {
    it('delegates to store and returns created node', async () => {
      const core = new GraphCoreImpl();
      core.registerStore(mockStore);

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
      core.registerStore(mockStore);

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
      core.registerStore(mockStore);

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
      core.registerStore(mockStore);

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
      core.registerStore(mockStore);

      await expect(
        core.createNode({ title: 'No ID', content: '' })
      ).rejects.toThrow(/id/i);
    });

    it('throws if title is missing', async () => {
      const core = new GraphCoreImpl();
      core.registerStore(mockStore);

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
      core.registerStore(mockStore);

      const result = await core.updateNode('test.md', { title: 'Updated' });

      expect(mockStore.updateNode).toHaveBeenCalledWith('test.md', {
        title: 'Updated',
      });
      expect(result.title).toBe('Updated');
    });

    it('throws if node not found after update', async () => {
      vi.mocked(mockStore.getNode).mockResolvedValue(null);

      const core = new GraphCoreImpl();
      core.registerStore(mockStore);

      await expect(
        core.updateNode('vanished.md', { title: 'Ghost' })
      ).rejects.toThrow(/not found after update/i);
    });
  });

  describe('deleteNode', () => {
    it('delegates to store and returns true on success', async () => {
      const core = new GraphCoreImpl();
      core.registerStore(mockStore);

      const result = await core.deleteNode('test.md');

      expect(mockStore.deleteNode).toHaveBeenCalledWith('test.md');
      expect(result).toBe(true);
    });

    it('returns false when store throws', async () => {
      vi.mocked(mockStore.deleteNode).mockRejectedValue(
        new Error('Not found')
      );

      const core = new GraphCoreImpl();
      core.registerStore(mockStore);

      const result = await core.deleteNode('missing.md');
      expect(result).toBe(false);
    });
  });

  describe('getNeighbors', () => {
    it('delegates to store', async () => {
      const neighbors = [createMockNode('a.md'), createMockNode('b.md')];
      vi.mocked(mockStore.getNeighbors).mockResolvedValue(neighbors);

      const core = new GraphCoreImpl();
      core.registerStore(mockStore);

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
      core.registerStore(mockStore);

      const result = await core.findPath('a.md', 'c.md');

      expect(mockStore.findPath).toHaveBeenCalledWith('a.md', 'c.md');
      expect(result).toEqual(['a.md', 'b.md', 'c.md']);
    });

    it('returns null when no path', async () => {
      vi.mocked(mockStore.findPath).mockResolvedValue(null);

      const core = new GraphCoreImpl();
      core.registerStore(mockStore);

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
      core.registerStore(mockStore);

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
      core.registerStore(mockStore);

      const result = await core.searchByTags(['test'], 'any');

      expect(mockStore.searchByTags).toHaveBeenCalledWith(['test'], 'any');
      expect(result).toEqual(tagged);
    });

    it('respects limit parameter', async () => {
      const nodes = [
        createMockNode('a.md'),
        createMockNode('b.md'),
        createMockNode('c.md'),
      ];
      vi.mocked(mockStore.searchByTags).mockResolvedValue(nodes);

      const core = new GraphCoreImpl();
      core.registerStore(mockStore);

      const result = await core.searchByTags(['test'], 'any', 2);

      expect(result).toHaveLength(2);
    });
  });

  describe('getRandomNode', () => {
    it('delegates to store without tags', async () => {
      const node = createMockNode('random.md');
      vi.mocked(mockStore.getRandomNode).mockResolvedValue(node);

      const core = new GraphCoreImpl();
      core.registerStore(mockStore);

      const result = await core.getRandomNode();

      expect(mockStore.getRandomNode).toHaveBeenCalledWith(undefined);
      expect(result?.id).toBe('random.md');
    });

    it('delegates to store with tags', async () => {
      const node = createMockNode('tagged.md', { tags: ['special'] });
      vi.mocked(mockStore.getRandomNode).mockResolvedValue(node);

      const core = new GraphCoreImpl();
      core.registerStore(mockStore);

      const result = await core.getRandomNode(['special']);

      expect(mockStore.getRandomNode).toHaveBeenCalledWith(['special']);
      expect(result?.id).toBe('tagged.md');
    });

    it('returns null when store returns null', async () => {
      vi.mocked(mockStore.getRandomNode).mockResolvedValue(null);

      const core = new GraphCoreImpl();
      core.registerStore(mockStore);

      const result = await core.getRandomNode();
      expect(result).toBeNull();
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

    it('throws if store config missing', () => {
      const config = { providers: {} } as RouxConfig;

      expect(() => GraphCoreImpl.fromConfig(config)).toThrow(/store/i);
    });

    it('accepts docstore config', () => {
      const config: RouxConfig = {
        providers: {
          store: { type: 'docstore' },
        },
        source: { path: join(tempDir, 'source'), include: ['*.md'], exclude: [] },
        cache: { path: join(tempDir, 'cache') },
      };

      // This should not throw - it creates the DocStore
      const core = GraphCoreImpl.fromConfig(config);
      expect(core).toBeDefined();
    });

    it('uses default paths when source and cache not specified', () => {
      // Need to run from a temp dir for this test
      const originalCwd = process.cwd();
      process.chdir(tempDir);

      try {
        const config: RouxConfig = {
          providers: {
            store: { type: 'docstore' },
          },
        };

        const core = GraphCoreImpl.fromConfig(config);
        expect(core).toBeDefined();
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('uses local embedding with custom model', () => {
      const config: RouxConfig = {
        providers: {
          store: { type: 'docstore' },
          embedding: { type: 'local', model: 'custom-model' },
        },
        source: { path: join(tempDir, 'source'), include: ['*.md'], exclude: [] },
        cache: { path: join(tempDir, 'cache2') },
      };

      const core = GraphCoreImpl.fromConfig(config);
      expect(core).toBeDefined();
    });

    it('throws on unsupported embedding type', () => {
      const config: RouxConfig = {
        providers: {
          store: { type: 'docstore' },
          embedding: { type: 'openai' as 'local' },
        },
        source: { path: join(tempDir, 'source'), include: ['*.md'], exclude: [] },
        cache: { path: join(tempDir, 'cache3') },
      };

      expect(() => GraphCoreImpl.fromConfig(config)).toThrow(/unsupported/i);
    });
  });
});
