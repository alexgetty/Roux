import { readFile, writeFile, stat, readdir, mkdir, rm } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';
import type { DirectedGraph } from 'graphology';
import type { Node } from '../../types/node.js';
import type {
  StoreProvider,
  NeighborOptions,
  Metric,
  TagMode,
  VectorSearchResult,
} from '../../types/provider.js';
import { Cache } from './cache.js';
import {
  parseMarkdown,
  extractWikiLinks,
  normalizeId,
  titleFromPath,
  serializeToMarkdown,
} from './parser.js';
import { buildGraph } from '../../graph/builder.js';
import {
  getNeighborIds,
  findPath as graphFindPath,
  getHubs as graphGetHubs,
  computeCentrality,
} from '../../graph/operations.js';

export class DocStore implements StoreProvider {
  private cache: Cache;
  private sourceRoot: string;
  private graph: DirectedGraph | null = null;

  constructor(sourceRoot: string, cacheDir: string) {
    this.sourceRoot = sourceRoot;
    this.cache = new Cache(cacheDir);
  }

  async sync(): Promise<void> {
    const currentPaths = await this.collectMarkdownFiles(this.sourceRoot);
    const trackedPaths = this.cache.getAllTrackedPaths();

    // Process new/modified files
    for (const filePath of currentPaths) {
      const mtime = await this.getFileMtime(filePath);
      const cachedMtime = this.cache.getModifiedTime(filePath);

      if (cachedMtime === null || mtime > cachedMtime) {
        const node = await this.fileToNode(filePath);
        this.cache.upsertNode(node, 'file', filePath, mtime);
      }
    }

    // Remove deleted files
    const currentSet = new Set(currentPaths);
    for (const tracked of trackedPaths) {
      if (!currentSet.has(tracked)) {
        const node = this.cache.getNodeByPath(tracked);
        if (node) {
          this.cache.deleteNode(node.id);
        }
      }
    }

    // Rebuild graph from all nodes
    this.rebuildGraph();
  }

  async createNode(node: Node): Promise<void> {
    const existing = this.cache.getNode(node.id);
    if (existing) {
      throw new Error(`Node already exists: ${node.id}`);
    }

    const filePath = join(this.sourceRoot, node.id);
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });

    const parsed = {
      title: node.title,
      tags: node.tags,
      properties: node.properties,
      content: node.content,
    };
    const markdown = serializeToMarkdown(parsed);
    await writeFile(filePath, markdown, 'utf-8');

    const mtime = await this.getFileMtime(filePath);
    this.cache.upsertNode(node, 'file', filePath, mtime);

    // Rebuild graph to include new node
    this.rebuildGraph();
  }

  async updateNode(id: string, updates: Partial<Node>): Promise<void> {
    const existing = this.cache.getNode(id);
    if (!existing) {
      throw new Error(`Node not found: ${id}`);
    }

    const updated: Node = {
      ...existing,
      ...updates,
      id: existing.id, // ID cannot be changed
    };

    const filePath = join(this.sourceRoot, id);
    const parsed = {
      title: updated.title,
      tags: updated.tags,
      properties: updated.properties,
      content: updated.content,
    };
    const markdown = serializeToMarkdown(parsed);
    await writeFile(filePath, markdown, 'utf-8');

    const mtime = await this.getFileMtime(filePath);
    this.cache.upsertNode(updated, 'file', filePath, mtime);

    // Rebuild graph if links changed
    if (updates.outgoingLinks !== undefined) {
      this.rebuildGraph();
    }
  }

  async deleteNode(id: string): Promise<void> {
    const existing = this.cache.getNode(id);
    if (!existing) {
      throw new Error(`Node not found: ${id}`);
    }

    const filePath = join(this.sourceRoot, id);
    await rm(filePath);
    this.cache.deleteNode(id);

    // Rebuild graph without deleted node
    this.rebuildGraph();
  }

  async getNode(id: string): Promise<Node | null> {
    // Normalize ID for case-insensitive lookup
    const normalizedId = normalizeId(id);
    return this.cache.getNode(normalizedId);
  }

  async getNodes(ids: string[]): Promise<Node[]> {
    const normalizedIds = ids.map(normalizeId);
    return this.cache.getNodes(normalizedIds);
  }

  async getAllNodeIds(): Promise<string[]> {
    const nodes = this.cache.getAllNodes();
    return nodes.map((n) => n.id);
  }

  async searchByTags(tags: string[], mode: TagMode): Promise<Node[]> {
    return this.cache.searchByTags(tags, mode);
  }

  async resolveTitles(ids: string[]): Promise<Map<string, string>> {
    return this.cache.resolveTitles(ids);
  }

  async getNeighbors(id: string, options: NeighborOptions): Promise<Node[]> {
    this.ensureGraph();
    const neighborIds = getNeighborIds(this.graph!, id, options);
    return this.cache.getNodes(neighborIds);
  }

  async findPath(source: string, target: string): Promise<string[] | null> {
    this.ensureGraph();
    return graphFindPath(this.graph!, source, target);
  }

  async getHubs(metric: Metric, limit: number): Promise<Array<[string, number]>> {
    this.ensureGraph();
    return graphGetHubs(this.graph!, metric, limit);
  }

  async storeEmbedding(
    _id: string,
    _vector: number[],
    _model: string
  ): Promise<void> {
    throw new Error('Not implemented: storeEmbedding is Phase 6');
  }

  async searchByVector(
    _vector: number[],
    _limit: number
  ): Promise<VectorSearchResult[]> {
    throw new Error('Not implemented: searchByVector is Phase 6');
  }

  close(): void {
    this.cache.close();
  }

  private ensureGraph(): void {
    if (!this.graph) {
      this.rebuildGraph();
    }
  }

  private rebuildGraph(): void {
    const nodes = this.cache.getAllNodes();
    this.graph = buildGraph(nodes);

    // Cache centrality metrics
    const centrality = computeCentrality(this.graph);
    const now = Date.now();
    for (const [id, metrics] of centrality) {
      this.cache.storeCentrality(id, 0, metrics.inDegree, metrics.outDegree, now);
    }
  }

  private async collectMarkdownFiles(dir: string): Promise<string[]> {
    const results: string[] = [];

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      // Directory doesn't exist yet
      return results;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        const nested = await this.collectMarkdownFiles(fullPath);
        results.push(...nested);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }

    return results;
  }

  private async getFileMtime(filePath: string): Promise<number> {
    const stats = await stat(filePath);
    return stats.mtimeMs;
  }

  private async fileToNode(filePath: string): Promise<Node> {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = parseMarkdown(raw);

    const relativePath = relative(this.sourceRoot, filePath);
    const id = normalizeId(relativePath);

    // Derive title from path if not in frontmatter
    const title = parsed.title ?? titleFromPath(id);

    // Extract and normalize wiki links
    const rawLinks = extractWikiLinks(parsed.content);
    const outgoingLinks = rawLinks.map((link) => this.normalizeWikiLink(link));

    return {
      id,
      title,
      content: parsed.content,
      tags: parsed.tags,
      outgoingLinks,
      properties: parsed.properties,
      sourceRef: {
        type: 'file',
        path: filePath,
        lastModified: new Date(await this.getFileMtime(filePath)),
      },
    };
  }

  /**
   * Normalize a wiki-link target to an ID.
   * - If it has an extension, normalize as-is
   * - If no extension, add .md
   * - Lowercase, forward slashes
   */
  private normalizeWikiLink(target: string): string {
    let normalized = target.toLowerCase().replace(/\\/g, '/');

    // Add .md if no extension present
    if (!normalized.includes('.')) {
      normalized += '.md';
    }

    return normalized;
  }
}

export { Cache } from './cache.js';
export {
  parseMarkdown,
  extractWikiLinks,
  normalizeId,
  titleFromPath,
  serializeToMarkdown,
} from './parser.js';
