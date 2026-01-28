import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join, relative, dirname, extname } from 'node:path';
import type { Node } from '../../types/node.js';
import type {
  Store,
  NeighborOptions,
  Metric,
  TagMode,
  VectorSearchResult,
  VectorIndex,
  ListFilter,
  ListOptions,
  ListNodesResult,
  ResolveOptions,
  ResolveResult,
  CentralityMetrics,
} from '../../types/provider.js';
import { Cache } from './cache.js';
import { SqliteVectorIndex } from '../vector/sqlite.js';
import {
  extractWikiLinks,
  normalizeId,
  serializeToMarkdown,
} from './parser.js';
import { GraphManager } from '../../graph/manager.js';
import { FileWatcher, type FileEventType } from './watcher.js';
import {
  normalizeWikiLink,
  buildFilenameIndex,
  resolveLinks,
} from './links.js';
import {
  getFileMtime,
  validatePathWithinSource,
  collectFiles,
  readFileContent,
} from './file-operations.js';
import { ReaderRegistry } from './reader-registry.js';
import type { FileContext } from './types.js';
import { MarkdownReader } from './readers/index.js';

/**
 * Create a registry with default readers pre-registered.
 * Returns a new instance each call.
 */
function createDefaultRegistry(): ReaderRegistry {
  const registry = new ReaderRegistry();
  registry.register(new MarkdownReader());
  return registry;
}

export class DocStore implements Store {
  private cache: Cache;
  private sourceRoot: string;
  private graphManager: GraphManager = new GraphManager();
  private vectorIndex: VectorIndex;
  private ownsVectorIndex: boolean;
  private registry: ReaderRegistry;

  private fileWatcher: FileWatcher | null = null;
  private onChangeCallback: ((changedIds: string[]) => void) | undefined;

  constructor(
    sourceRoot: string,
    cacheDir: string,
    vectorIndex?: VectorIndex,
    registry?: ReaderRegistry
  ) {
    this.sourceRoot = sourceRoot;
    this.cache = new Cache(cacheDir);
    this.ownsVectorIndex = !vectorIndex;
    this.vectorIndex = vectorIndex ?? new SqliteVectorIndex(cacheDir);
    this.registry = registry ?? createDefaultRegistry();
  }

  async sync(): Promise<void> {
    const extensions = this.registry.getExtensions();
    const currentPaths = await collectFiles(this.sourceRoot, extensions);
    const trackedPaths = this.cache.getAllTrackedPaths();

    // Process new/modified files
    for (const filePath of currentPaths) {
      try {
        const mtime = await getFileMtime(filePath);
        const cachedMtime = this.cache.getModifiedTime(filePath);

        if (cachedMtime === null || mtime > cachedMtime) {
          const node = await this.parseFile(filePath);
          this.cache.upsertNode(node, 'file', filePath, mtime);
        }
      } catch (err) {
        // File may have been deleted between readdir and stat — skip silently
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          continue;
        }
        // All other errors (parse failures, read errors): log and skip file
        // Graceful degradation - one bad file shouldn't crash the entire sync
        console.warn(`Failed to process file ${filePath}:`, err);
        continue;
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
    const centrality = this.graphManager.build(this.cache.getAllNodes());
    this.storeCentrality(centrality);
  }

  async createNode(node: Node): Promise<void> {
    const normalizedId = normalizeId(node.id);
    validatePathWithinSource(this.sourceRoot, normalizedId);

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

    const mtime = await getFileMtime(filePath);
    const normalizedNode = { ...node, id: normalizedId };
    this.cache.upsertNode(normalizedNode, 'file', filePath, mtime);

    // Rebuild graph to include new node
    const centrality = this.graphManager.build(this.cache.getAllNodes());
    this.storeCentrality(centrality);
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

    const mtime = await getFileMtime(filePath);
    this.cache.upsertNode(updated, 'file', filePath, mtime);

    // Rebuild graph if links changed
    if (outgoingLinks !== undefined || updates.outgoingLinks !== undefined) {
      const centrality = this.graphManager.build(this.cache.getAllNodes());
      this.storeCentrality(centrality);
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
    await this.vectorIndex.delete(existing.id);

    // Rebuild graph without deleted node
    const centrality = this.graphManager.build(this.cache.getAllNodes());
    this.storeCentrality(centrality);
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
    if (!this.graphManager.isReady()) {
      return [];
    }
    const neighborIds = this.graphManager.getNeighborIds(id, options);
    return this.cache.getNodes(neighborIds);
  }

  async findPath(source: string, target: string): Promise<string[] | null> {
    if (!this.graphManager.isReady()) {
      return null;
    }
    return this.graphManager.findPath(source, target);
  }

  async getHubs(metric: Metric, limit: number): Promise<Array<[string, number]>> {
    if (!this.graphManager.isReady()) {
      return [];
    }
    return this.graphManager.getHubs(metric, limit);
  }

  async storeEmbedding(
    id: string,
    vector: number[],
    model: string
  ): Promise<void> {
    return this.vectorIndex.store(id, vector, model);
  }

  async searchByVector(
    vector: number[],
    limit: number
  ): Promise<VectorSearchResult[]> {
    return this.vectorIndex.search(vector, limit);
  }

  hasEmbedding(id: string): boolean {
    return this.vectorIndex.hasEmbedding(id);
  }

  close(): void {
    this.stopWatching();
    this.cache.close();
    if (this.ownsVectorIndex && 'close' in this.vectorIndex) {
      (this.vectorIndex as { close: () => void }).close();
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
        extensions: this.registry.getExtensions(),
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
            await this.vectorIndex.delete(id);
            processedIds.push(id);
          }
        } else {
          // add or change
          const filePath = join(this.sourceRoot, id);
          const node = await this.parseFile(filePath);
          const mtime = await getFileMtime(filePath);
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
      const centrality = this.graphManager.build(this.cache.getAllNodes());
      this.storeCentrality(centrality);
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

  private storeCentrality(centrality: Map<string, CentralityMetrics>): void {
    const now = Date.now();
    for (const [id, metrics] of centrality) {
      this.cache.storeCentrality(id, 0, metrics.inDegree, metrics.outDegree, now);
    }
  }

  /**
   * Parse a file into a Node using the appropriate FormatReader.
   */
  private async parseFile(filePath: string): Promise<Node> {
    const content = await readFileContent(filePath);
    const relativePath = relative(this.sourceRoot, filePath);
    const ext = extname(filePath).toLowerCase();
    const mtime = new Date(await getFileMtime(filePath));

    const context: FileContext = {
      absolutePath: filePath,
      relativePath,
      extension: ext,
      mtime,
    };

    return this.registry.parse(content, context);
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
export {
  getFileMtime,
  validatePathWithinSource,
  collectFiles,
  readFileContent,
} from './file-operations.js';
export type { FormatReader, FileContext } from './types.js';
export { ReaderRegistry } from './reader-registry.js';
export { MarkdownReader } from './readers/index.js';
export { createDefaultRegistry };
