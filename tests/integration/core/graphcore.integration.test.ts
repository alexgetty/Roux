import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GraphCoreImpl } from '../../../src/core/graphcore.js';
import { DocStore } from '../../../src/providers/docstore/index.js';
import { TransformersEmbedding } from '../../../src/providers/embedding/transformers.js';

describe('GraphCore Integration', () => {
  let tempDir: string;
  let sourceDir: string;
  let cacheDir: string;
  let store: DocStore;
  let embedding: TransformersEmbedding;
  let core: GraphCoreImpl;

  beforeAll(async () => {
    // Initialize embedding provider once (model loading is expensive)
    embedding = new TransformersEmbedding();
    // Warm up the model
    await embedding.embed('warmup');
  }, 60000);

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roux-graphcore-integration-'));
    sourceDir = join(tempDir, 'source');
    cacheDir = join(tempDir, 'cache');
    await mkdir(sourceDir, { recursive: true });

    store = new DocStore(sourceDir, cacheDir);
    core = new GraphCoreImpl();
    core.registerStore(store);
    core.registerEmbedding(embedding);
  });

  afterEach(async () => {
    store.close();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  const writeMarkdownFile = async (
    relativePath: string,
    content: string
  ): Promise<void> => {
    const fullPath = join(sourceDir, relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    if (dir !== sourceDir) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(fullPath, content, 'utf-8');
  };

  describe('search flow', () => {
    it('embeds, stores, and retrieves via semantic search', async () => {
      // Create a node about machine learning
      await writeMarkdownFile(
        'ml-basics.md',
        '---\ntitle: Machine Learning Basics\ntags:\n  - ai\n---\nMachine learning is a subset of artificial intelligence that enables systems to learn from data.'
      );
      await store.sync();

      // Generate and store embedding
      const node = await store.getNode('ml-basics.md');
      expect(node).not.toBeNull();

      const vector = await embedding.embed(node!.content);
      await store.storeEmbedding(node!.id, vector, embedding.modelId());

      // Search with a related query
      const results = await core.search('AI and neural networks', { limit: 5 });

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('ml-basics.md');
      expect(results[0]!.title).toBe('Machine Learning Basics');
    });

    it('ranks semantically similar content higher', async () => {
      // Create multiple nodes with different content
      await writeMarkdownFile(
        'cooking.md',
        '---\ntitle: Cooking Tips\n---\nHow to make pasta and pizza from scratch.'
      );
      await writeMarkdownFile(
        'deep-learning.md',
        '---\ntitle: Deep Learning\n---\nNeural networks with multiple layers for complex pattern recognition.'
      );
      await writeMarkdownFile(
        'gardening.md',
        '---\ntitle: Gardening Guide\n---\nPlanting flowers and vegetables in your backyard.'
      );
      await store.sync();

      // Generate embeddings for all nodes
      const allIds = await store.getAllNodeIds();
      for (const id of allIds) {
        const node = await store.getNode(id);
        if (node) {
          const vector = await embedding.embed(node.content);
          await store.storeEmbedding(id, vector, embedding.modelId());
        }
      }

      // Search for AI-related content
      const results = await core.search('artificial intelligence', { limit: 3 });

      expect(results.length).toBeGreaterThan(0);
      // Deep learning should rank highest for AI query
      expect(results[0]!.id).toBe('deep-learning.md');
    });

    it('respects limit parameter', async () => {
      // Create several nodes
      for (let i = 0; i < 5; i++) {
        await writeMarkdownFile(
          `note-${i}.md`,
          `---\ntitle: Note ${i}\n---\nThis is note number ${i} about programming.`
        );
      }
      await store.sync();

      // Generate embeddings
      const allIds = await store.getAllNodeIds();
      for (const id of allIds) {
        const node = await store.getNode(id);
        if (node) {
          const vector = await embedding.embed(node.content);
          await store.storeEmbedding(id, vector, embedding.modelId());
        }
      }

      const results = await core.search('programming', { limit: 2 });
      expect(results).toHaveLength(2);
    });
  });

  describe('embedding consistency', () => {
    it('embedding dimensions match provider.dimensions()', async () => {
      const text = 'Sample text for embedding';
      const vector = await embedding.embed(text);

      expect(vector.length).toBe(embedding.dimensions());
      expect(vector.length).toBe(384); // MiniLM-L6-v2 produces 384-dim vectors
    });

    it('all embeddings have consistent dimensions', async () => {
      const texts = [
        'Short text',
        'A much longer text that contains many more words and should still produce the same dimension vector',
        '日本語テキスト', // Japanese text
        '🚀 Emoji content 🎉',
      ];

      const vectors = await embedding.embedBatch(texts);

      for (const vector of vectors) {
        expect(vector.length).toBe(embedding.dimensions());
      }
    });
  });

  describe('CRUD operations', () => {
    it('creates node and makes it searchable', async () => {
      await store.sync();

      const created = await core.createNode({
        id: 'new-note.md',
        title: 'New Note',
        content: 'Content about quantum computing and qubits.',
        tags: ['physics', 'computing'],
      });

      expect(created.id).toBe('new-note.md');
      expect(created.title).toBe('New Note');

      // Embed the new node
      const vector = await embedding.embed(created.content);
      await store.storeEmbedding(created.id, vector, embedding.modelId());

      // Should be searchable
      const results = await core.search('quantum physics', { limit: 5 });
      expect(results.some((r) => r.id === 'new-note.md')).toBe(true);
    });

    it('updates node content and remains searchable', async () => {
      await writeMarkdownFile(
        'updateable.md',
        '---\ntitle: Updateable\n---\nOriginal content about cats.'
      );
      await store.sync();

      // Embed original
      let node = await store.getNode('updateable.md');
      let vector = await embedding.embed(node!.content);
      await store.storeEmbedding(node!.id, vector, embedding.modelId());

      // Update content
      await core.updateNode('updateable.md', {
        content: 'Updated content about dogs and puppies.',
      });

      // Re-embed (in real usage, serve layer handles this)
      node = await store.getNode('updateable.md');
      vector = await embedding.embed(node!.content);
      await store.storeEmbedding(node!.id, vector, embedding.modelId());

      // Search should find updated content
      const results = await core.search('dogs puppies', { limit: 5 });
      expect(results.some((r) => r.id === 'updateable.md')).toBe(true);
    });

    it('deleted node is not searchable', async () => {
      await writeMarkdownFile(
        'deleteme.md',
        '---\ntitle: Delete Me\n---\nContent to be deleted about elephants.'
      );
      await store.sync();

      // Embed
      const node = await store.getNode('deleteme.md');
      const vector = await embedding.embed(node!.content);
      await store.storeEmbedding(node!.id, vector, embedding.modelId());

      // Verify searchable
      let results = await core.search('elephants', { limit: 5 });
      expect(results.some((r) => r.id === 'deleteme.md')).toBe(true);

      // Delete
      const deleted = await core.deleteNode('deleteme.md');
      expect(deleted).toBe(true);

      // Should not be searchable
      results = await core.search('elephants', { limit: 5 });
      expect(results.some((r) => r.id === 'deleteme.md')).toBe(false);
    });
  });

  describe('graph operations', () => {
    beforeEach(async () => {
      // Create a small graph: A -> B -> C, A -> C
      // Wiki-links normalize to lowercase + .md: [[node-b]] becomes node-b.md
      await writeMarkdownFile(
        'node-a.md',
        '---\ntitle: Node A\n---\nLinks to [[node-b]] and [[node-c]].'
      );
      await writeMarkdownFile(
        'node-b.md',
        '---\ntitle: Node B\n---\nLinks to [[node-c]].'
      );
      await writeMarkdownFile('node-c.md', '---\ntitle: Node C\n---\nNo links.');
      await store.sync();
    });

    it('getNode with depth=1 includes neighbor context', async () => {
      const nodeWithContext = await core.getNode('node-a.md', 1);

      expect(nodeWithContext).not.toBeNull();
      expect(nodeWithContext!.outgoingCount).toBe(2); // B and C
      expect(nodeWithContext!.incomingCount).toBe(0); // Nothing links to A
      expect(nodeWithContext!.neighbors).toHaveLength(2);
    });

    it('getNeighbors returns correct nodes by direction', async () => {
      const outgoing = await core.getNeighbors('node-a.md', { direction: 'out' });
      expect(outgoing).toHaveLength(2);
      expect(outgoing.map((n) => n.id).sort()).toEqual(['node-b.md', 'node-c.md']);

      const incoming = await core.getNeighbors('node-c.md', { direction: 'in' });
      expect(incoming).toHaveLength(2);
      expect(incoming.map((n) => n.id).sort()).toEqual(['node-a.md', 'node-b.md']);
    });

    it('findPath returns shortest path', async () => {
      // A -> B -> C, but also A -> C directly
      const path = await core.findPath('node-a.md', 'node-c.md');

      expect(path).not.toBeNull();
      // Direct path A -> C is shorter than A -> B -> C
      expect(path).toEqual(['node-a.md', 'node-c.md']);
    });

    it('findPath returns null when no path exists', async () => {
      // No path from C to A (links are directed)
      const path = await core.findPath('node-c.md', 'node-a.md');
      expect(path).toBeNull();
    });

    it('getHubs returns most connected nodes', async () => {
      const hubs = await core.getHubs('in_degree', 3);

      expect(hubs.length).toBeGreaterThan(0);
      // C has highest in-degree (2 incoming links)
      expect(hubs[0]![0]).toBe('node-c.md');
      expect(hubs[0]![1]).toBe(2);
    });
  });

  describe('tag operations', () => {
    beforeEach(async () => {
      await writeMarkdownFile(
        'tagged-a.md',
        '---\ntitle: Tagged A\ntags:\n  - alpha\n  - beta\n---\nContent A.'
      );
      await writeMarkdownFile(
        'tagged-b.md',
        '---\ntitle: Tagged B\ntags:\n  - beta\n  - gamma\n---\nContent B.'
      );
      await writeMarkdownFile(
        'tagged-c.md',
        '---\ntitle: Tagged C\ntags:\n  - alpha\n---\nContent C.'
      );
      await store.sync();
    });

    it('searchByTags with mode=any returns nodes with any matching tag', async () => {
      const results = await core.searchByTags(['alpha'], 'any');
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.id).sort()).toEqual(['tagged-a.md', 'tagged-c.md']);
    });

    it('searchByTags with mode=all returns nodes with all matching tags', async () => {
      const results = await core.searchByTags(['alpha', 'beta'], 'all');
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('tagged-a.md');
    });

    it('getRandomNode with tag filter returns matching node', async () => {
      const node = await core.getRandomNode(['gamma']);
      expect(node).not.toBeNull();
      expect(node!.id).toBe('tagged-b.md'); // Only one has gamma tag
    });
  });

  describe('fromConfig factory', () => {
    it('creates working GraphCore from minimal config', async () => {
      const configuredCore = GraphCoreImpl.fromConfig({
        providers: {
          store: {
            type: 'docstore',
          },
        },
        source: {
          path: sourceDir,
        },
        cache: {
          path: cacheDir,
        },
      });

      // Should be able to use it
      await writeMarkdownFile(
        'config-test.md',
        '---\ntitle: Config Test\n---\nTesting fromConfig.'
      );

      // Access the store directly for sync (normally CLI does this)
      const configStore = new DocStore(sourceDir, cacheDir);
      await configStore.sync();

      const node = await configuredCore.getNode('config-test.md');
      expect(node).not.toBeNull();
      expect(node!.title).toBe('Config Test');

      configStore.close();
    });
  });
});
