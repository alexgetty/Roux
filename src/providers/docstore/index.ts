import { readFile, writeFile, stat, readdir, mkdir, rm } from 'node:fs/promises';
import { join, relative, dirname, resolve } from 'node:path';
import type { DirectedGraph } from 'graphology';
import type { Node } from '../../types/node.js';
import type {
  StoreProvider,
  NeighborOptions,
  Metric,
  TagMode,
  VectorSearchResult,
  VectorProvider,
  ListFilter,
  ListOptions,
  ListNodesResult,
  ResolveOptions,
  ResolveResult,
} from '../../types/provider.js';
import { Cache } from './cache.js';
import { SqliteVectorProvider } from '../vector/sqlite.js';
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
import { FileWatcher, EXCLUDED_DIRS, type FileEventType } from './watcher.js';
import {
  normalizeWikiLink,
  buildFilenameIndex,
  resolveLinks,
} from './links.js';

export class DocStore implements StoreProvider {
  private cache: Cache;
  private sourceRoot: string;
  private graph: DirectedGraph | null = null;
  private vectorProvider: VectorProvider;
  private ownsVectorProvider: boolean;

  private fileWatcher: FileWatcher | null = null;
  private onChangeCallback: ((changedIds: string[]) => void) | undefined;

  constructor(
    sourceRoot: string,
    cacheDir: string,
    vectorProvider?: VectorProvider,
    fileWatcher?: FileWatcher
  ) {
    this.sourceRoot = sourceRoot;
    this.cache = new Cache(cacheDir);
    this.ownsVectorProvider = !vectorProvider;
    this.vectorProvider = vectorProvider ?? new SqliteVectorProvider(cacheDir);
    this.fileWatcher = fileWatcher ?? null;
  }

  async sync(): Promise<void> {
    const currentPaths = await this.collectMarkdownFiles(this.sourceRoot);
    const trackedPaths = this.cache.getAllTrackedPaths();

    // Process new/modified files
    for (const filePath of currentPaths) {
      try {
        const mtime = await this.getFileMtime(filePath);
        const cachedMtime = this.cache.getModifiedTime(filePath);

        if (cachedMtime === null || mtime > cachedMtime) {
          const node = await this.fileToNode(filePath);
          this.cache.upsertNode(node, 'file', filePath, mtime);
        }
      } catch (err) {
        // File may have been deleted between readdir and stat — skip it
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          continue;
        }
        throw err;
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

    // Resolve wiki-links after all nodes are cached
    this.resolveAllLinks();

    // Rebuild graph from all nodes
    this.rebuildGraph();
  }

  async createNode(node: Node): Promise<void> {
    const normalizedId = normalizeId(node.id);
    this.validatePathWithinSource(normalizedId);

    const existing = this.cache.getNode(normalizedId);
    if (existing) {
      throw new Error(`Node already exists: ${normalizedId}`);
    }

    const filePath = join(this.sourceRoot, normalizedId);
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
    const normalizedNode = { ...node, id: normalizedId };
    this.cache.upsertNode(normalizedNode, 'file', filePath, mtime);

    // Rebuild graph to include new node
    this.rebuildGraph();
  }

  async updateNode(id: string, updates: Partial<Node>): Promise<void> {
    const normalizedId = normalizeId(id);
    const existing = this.cache.getNode(normalizedId);
    if (!existing) {
      throw new Error(`Node not found: ${id}`);
    }

    // If content is updated, reparse wiki-links
    let outgoingLinks = updates.outgoingLinks;
    if (updates.content !== undefined && outgoingLinks === undefined) {
      const rawLinks = extractWikiLinks(updates.content);
      outgoingLinks = rawLinks.map((link) => normalizeWikiLink(link));
    }

    const updated: Node = {
      ...existing,
      ...updates,
      outgoingLinks: outgoingLinks ?? existing.outgoingLinks,
      id: existing.id, // ID cannot be changed
    };

    const filePath = join(this.sourceRoot, existing.id);
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
    if (outgoingLinks !== undefined || updates.outgoingLinks !== undefined) {
      this.rebuildGraph();
    }
  }

  async deleteNode(id: string): Promise<void> {
    const normalizedId = normalizeId(id);
    const existing = this.cache.getNode(normalizedId);
    if (!existing) {
      throw new Error(`Node not found: ${id}`);
    }

    const filePath = join(this.sourceRoot, existing.id);
    await rm(filePath);
    this.cache.deleteNode(existing.id);
    await this.vectorProvider.delete(existing.id);

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

  async searchByTags(tags: string[], mode: TagMode, limit?: number): Promise<Node[]> {
    return this.cache.searchByTags(tags, mode, limit);
  }

  async getRandomNode(tags?: string[]): Promise<Node | null> {
    let candidates: Node[];

    if (tags && tags.length > 0) {
      candidates = await this.searchByTags(tags, 'any');
    } else {
      candidates = this.cache.getAllNodes();
    }

    if (candidates.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * candidates.length);
    // Safe: randomIndex is always 0 to length-1 when length > 0
    return candidates[randomIndex]!;
  }

  async resolveTitles(ids: string[]): Promise<Map<string, string>> {
    return this.cache.resolveTitles(ids);
  }

  async listNodes(
    filter: ListFilter,
    options?: ListOptions
  ): Promise<ListNodesResult> {
    return this.cache.listNodes(filter, options);
  }

  async resolveNodes(
    names: string[],
    options?: ResolveOptions
  ): Promise<ResolveResult[]> {
    // For exact and fuzzy, delegate to cache
    const strategy = options?.strategy ?? 'fuzzy';
    if (strategy === 'exact' || strategy === 'fuzzy') {
      return this.cache.resolveNodes(names, options);
    }

    // Semantic strategy: use vector search
    // This requires embedding provider which DocStore doesn't have direct access to
    // Return unmatched for now - GraphCore will handle semantic with embedding provider
    return names.map((query) => ({ query, match: null, score: 0 }));
  }

  async nodesExist(ids: string[]): Promise<Map<string, boolean>> {
    const normalizedIds = ids.map(normalizeId);
    return this.cache.nodesExist(normalizedIds);
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
    id: string,
    vector: number[],
    model: string
  ): Promise<void> {
    return this.vectorProvider.store(id, vector, model);
  }

  async searchByVector(
    vector: number[],
    limit: number
  ): Promise<VectorSearchResult[]> {
    return this.vectorProvider.search(vector, limit);
  }

  hasEmbedding(id: string): boolean {
    return this.vectorProvider.hasEmbedding(id);
  }

  close(): void {
    this.stopWatching();
    this.cache.close();
    if (this.ownsVectorProvider && 'close' in this.vectorProvider) {
      (this.vectorProvider as { close: () => void }).close();
    }
  }

  startWatching(onChange?: (changedIds: string[]) => void): Promise<void> {
    if (this.fileWatcher?.isWatching()) {
      throw new Error('Already watching. Call stopWatching() first.');
    }

    this.onChangeCallback = onChange;

    if (!this.fileWatcher) {
      this.fileWatcher = new FileWatcher({
        root: this.sourceRoot,
        onBatch: (events) => this.handleWatcherBatch(events),
      });
    }

    return this.fileWatcher.start();
  }

  stopWatching(): void {
    if (this.fileWatcher) {
      this.fileWatcher.stop();
    }
  }

  isWatching(): boolean {
    return this.fileWatcher?.isWatching() ?? false;
  }

  private async handleWatcherBatch(events: Map<string, FileEventType>): Promise<void> {
    const processedIds: string[] = [];

    for (const [id, event] of events) {
      try {
        if (event === 'unlink') {
          const existing = this.cache.getNode(id);
          if (existing) {
            this.cache.deleteNode(id);
            await this.vectorProvider.delete(id);
            processedIds.push(id);
          }
        } else {
          // add or change
          const filePath = join(this.sourceRoot, id);
          const node = await this.fileToNode(filePath);
          const mtime = await this.getFileMtime(filePath);
          this.cache.upsertNode(node, 'file', filePath, mtime);
          processedIds.push(id);
        }
      } catch (err) {
        console.warn(`Failed to process file change for ${id}:`, err);
      }
    }

    // Resolve wiki-links and rebuild graph after processing all changes
    if (processedIds.length > 0) {
      this.resolveAllLinks();
      this.rebuildGraph();
    }

    // Call callback if provided
    if (this.onChangeCallback && processedIds.length > 0) {
      this.onChangeCallback(processedIds);
    }
  }

  private resolveAllLinks(): void {
    const nodes = this.cache.getAllNodes();
    const filenameIndex = buildFilenameIndex(nodes);

    // Build set of valid node IDs
    const validNodeIds = new Set<string>();
    for (const paths of filenameIndex.values()) {
      for (const path of paths) {
        validNodeIds.add(path);
      }
    }

    // Resolve links for each node and update cache if changed
    for (const node of nodes) {
      const resolved = resolveLinks(
        node.outgoingLinks,
        filenameIndex,
        validNodeIds
      );

      if (resolved.some((r, i) => r !== node.outgoingLinks[i])) {
        this.cache.updateOutgoingLinks(node.id, resolved);
      }
    }
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
        // Skip excluded directories
        if (EXCLUDED_DIRS.has(entry.name)) {
          continue;
        }
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
    const outgoingLinks = rawLinks.map((link) => normalizeWikiLink(link));

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

  private validatePathWithinSource(id: string): void {
    const resolvedPath = resolve(this.sourceRoot, id);
    const resolvedRoot = resolve(this.sourceRoot);

    if (!resolvedPath.startsWith(resolvedRoot + '/')) {
      throw new Error(`Path traversal detected: ${id} resolves outside source root`);
    }
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
export { FileWatcher, EXCLUDED_DIRS, type FileEventType } from './watcher.js';
