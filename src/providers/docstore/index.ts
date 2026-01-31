import { writeFile, mkdir, rm } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { join, relative, dirname, extname } from 'node:path';
import type { Node, NodeUpdates } from '../../types/node.js';
import type {
  TagMode,
  VectorIndex,
  ListFilter,
  ListOptions,
  ListNodesResult,
  ResolveOptions,
  ResolveResult,
  CentralityMetrics,
} from '../../types/provider.js';
import { StoreProvider } from '../store/index.js';
import { Cache } from './cache.js';
import { SqliteVectorIndex } from '../vector/sqlite.js';
import {
  extractWikiLinks,
  normalizeId,
  serializeToMarkdown,
} from './parser.js';
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

export interface DocStoreOptions {
  sourceRoot: string;
  cacheDir: string;
  id?: string;
  vectorIndex?: VectorIndex;
  registry?: ReaderRegistry;
  /** Optional FileWatcher instance. If provided, DocStore uses it instead of creating one. */
  fileWatcher?: FileWatcher;
}

export class DocStore extends StoreProvider {
  readonly id: string;
  private cache: Cache;
  private sourceRoot: string;
  private ownsVectorIndex: boolean;
  private registry: ReaderRegistry;

  private fileWatcher: FileWatcher | null = null;
  private onChangeCallback: ((changedIds: string[]) => void) | undefined;

  constructor(options: DocStoreOptions) {
    const {
      sourceRoot,
      cacheDir,
      id = 'docstore',
      vectorIndex,
      registry,
      fileWatcher,
    } = options;

    const ownsVector = !vectorIndex;
    // Ensure cacheDir exists before SqliteVectorIndex tries to open a DB inside it
    if (!vectorIndex) mkdirSync(cacheDir, { recursive: true });
    const vi = vectorIndex ?? new SqliteVectorIndex(cacheDir);
    super({ vectorIndex: vi });

    this.id = id;
    this.sourceRoot = sourceRoot;
    this.cache = new Cache(cacheDir);
    this.ownsVectorIndex = ownsVector;
    this.registry = registry ?? createDefaultRegistry();
    this.fileWatcher = fileWatcher ?? null;
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
          const node = await this.parseFile(filePath, mtime);
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
    await this.syncGraph();
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

    const rawLinks = extractWikiLinks(node.content);
    const parsed = {
      title: node.title,
      tags: node.tags,
      properties: node.properties,
      content: node.content,
      rawLinks,
    };
    const markdown = serializeToMarkdown(parsed);
    await writeFile(filePath, markdown, 'utf-8');

    // Extract wikilinks from content
    let outgoingLinks = node.outgoingLinks;
    if (node.content && (!outgoingLinks || outgoingLinks.length === 0)) {
      outgoingLinks = rawLinks.map((link) => normalizeWikiLink(link));
    }

    const mtime = await getFileMtime(filePath);
    const normalizedNode = { ...node, id: normalizedId, outgoingLinks };
    this.cache.upsertNode(normalizedNode, 'file', filePath, mtime);

    // Resolve wikilinks and rebuild graph
    this.resolveAllLinks();
    await this.syncGraph();
  }

  async updateNode(id: string, updates: NodeUpdates): Promise<void> {
    const normalizedId = normalizeId(id);
    const existing = this.cache.getNode(normalizedId);
    if (!existing) {
      throw new Error(`Node not found: ${id}`);
    }

    // Derive outgoingLinks from content (new or existing)
    const contentForLinks = updates.content ?? existing.content;
    const rawLinks = extractWikiLinks(contentForLinks);
    const outgoingLinks = rawLinks.map((link) => normalizeWikiLink(link));

    const updated: Node = {
      ...existing,
      ...updates,
      outgoingLinks,
      id: existing.id,
    };

    const filePath = join(this.sourceRoot, existing.id);
    const parsed = {
      title: updated.title,
      tags: updated.tags,
      properties: updated.properties,
      content: updated.content,
      rawLinks,
    };
    const markdown = serializeToMarkdown(parsed);
    await writeFile(filePath, markdown, 'utf-8');

    const mtime = await getFileMtime(filePath);
    this.cache.upsertNode(updated, 'file', filePath, mtime);

    // Resolve wikilinks and rebuild graph
    this.resolveAllLinks();
    await this.syncGraph();
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
    if (this.vectorIndex) await this.vectorIndex.delete(existing.id);

    // Rebuild graph without deleted node
    await this.syncGraph();
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

  hasEmbedding(id: string): boolean {
    if (!this.vectorIndex) return false;
    return this.vectorIndex.hasEmbedding(id);
  }

  close(): void {
    this.stopWatching();
    this.cache.close();
    if (this.ownsVectorIndex && this.vectorIndex && 'close' in this.vectorIndex) {
      (this.vectorIndex as { close: () => void }).close();
    }
  }

  // Lifecycle hooks

  async onRegister(): Promise<void> {
    await this.sync();
  }

  async onUnregister(): Promise<void> {
    this.close();
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
            if (this.vectorIndex) await this.vectorIndex.delete(id);
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
      await this.syncGraph();
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

  // ── StoreProvider abstract method implementations ─────────

  protected async loadAllNodes(): Promise<Node[]> {
    return this.cache.getAllNodes();
  }

  protected async getNodesByIds(ids: string[]): Promise<Node[]> {
    return this.cache.getNodes(ids);
  }

  protected onCentralityComputed(centrality: Map<string, CentralityMetrics>): void {
    const now = Date.now();
    for (const [id, metrics] of centrality) {
      this.cache.storeCentrality(id, 0, metrics.inDegree, metrics.outDegree, now);
    }
  }

  /**
   * Parse a file into a Node using the appropriate FormatReader.
   * @param filePath Absolute path to the file
   * @param mtime Optional mtime in ms. If provided, avoids redundant stat call.
   */
  private async parseFile(filePath: string, mtime?: number): Promise<Node> {
    const content = await readFileContent(filePath);
    const relativePath = relative(this.sourceRoot, filePath);
    const ext = extname(filePath).toLowerCase();
    const actualMtime = new Date(mtime ?? await getFileMtime(filePath));

    const context: FileContext = {
      absolutePath: filePath,
      relativePath,
      extension: ext,
      mtime: actualMtime,
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
