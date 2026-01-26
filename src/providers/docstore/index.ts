import { readFile, writeFile, stat, readdir, mkdir, rm } from 'node:fs/promises';
import { join, relative, dirname, resolve } from 'node:path';
import { watch, type FSWatcher } from 'chokidar';
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

export class DocStore implements StoreProvider {
  private cache: Cache;
  private sourceRoot: string;
  private graph: DirectedGraph | null = null;
  private vectorProvider: VectorProvider;
  private ownsVectorProvider: boolean;

  private watcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingChanges: Map<string, 'add' | 'change' | 'unlink'> = new Map();
  private onChangeCallback: ((changedIds: string[]) => void) | undefined;

  constructor(
    sourceRoot: string,
    cacheDir: string,
    vectorProvider?: VectorProvider
  ) {
    this.sourceRoot = sourceRoot;
    this.cache = new Cache(cacheDir);
    this.ownsVectorProvider = !vectorProvider;
    this.vectorProvider = vectorProvider ?? new SqliteVectorProvider(cacheDir);
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
    const filenameIndex = this.buildFilenameIndex();
    this.resolveOutgoingLinks(filenameIndex);

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
      outgoingLinks = rawLinks.map((link) => this.normalizeWikiLink(link));
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
    if (this.watcher) {
      throw new Error('Already watching. Call stopWatching() first.');
    }

    this.onChangeCallback = onChange;

    return new Promise((resolve, reject) => {
      this.watcher = watch(this.sourceRoot, {
        ignoreInitial: true,
        ignored: [...DocStore.EXCLUDED_DIRS].map((dir) => `**/${dir}/**`),
        awaitWriteFinish: {
          stabilityThreshold: 100,
        },
        followSymlinks: false,
      });

      this.watcher
        .on('ready', () => resolve())
        .on('add', (path) => this.queueChange(path, 'add'))
        .on('change', (path) => this.queueChange(path, 'change'))
        .on('unlink', (path) => this.queueChange(path, 'unlink'))
        .on('error', (err) => {
          if ((err as NodeJS.ErrnoException).code === 'EMFILE') {
            console.error(
              'File watcher hit file descriptor limit. ' +
                'Try: ulimit -n 65536 or reduce watched files.'
            );
          }
          reject(err);
        });
    });
  }

  stopWatching(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingChanges.clear();

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  isWatching(): boolean {
    return this.watcher !== null;
  }

  private queueChange(filePath: string, event: 'add' | 'change' | 'unlink'): void {
    const relativePath = relative(this.sourceRoot, filePath);
    const id = normalizeId(relativePath);

    // Check exclusions
    if (!filePath.endsWith('.md')) {
      return;
    }

    // Check if path contains any excluded directory
    const pathParts = relativePath.split('/');
    for (const part of pathParts) {
      if (DocStore.EXCLUDED_DIRS.has(part)) {
        return;
      }
    }

    // Apply coalescing rules
    const existing = this.pendingChanges.get(id);

    if (existing) {
      if (existing === 'add' && event === 'change') {
        // add + change = add (keep as add)
        return;
      } else if (existing === 'add' && event === 'unlink') {
        // add + unlink = remove from queue
        this.pendingChanges.delete(id);
      } else if (existing === 'change' && event === 'unlink') {
        // change + unlink = unlink
        this.pendingChanges.set(id, 'unlink');
      }
      // change + change = change (already set, no action needed)
    } else {
      this.pendingChanges.set(id, event);
    }

    // Reset debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processQueue();
    }, 1000);
  }

  private async processQueue(): Promise<void> {
    const changes = new Map(this.pendingChanges);
    this.pendingChanges.clear();
    this.debounceTimer = null;

    const processedIds: string[] = [];

    for (const [id, event] of changes) {
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
      const filenameIndex = this.buildFilenameIndex();
      this.resolveOutgoingLinks(filenameIndex);
      this.rebuildGraph();
    }

    // Call callback if provided
    if (this.onChangeCallback && processedIds.length > 0) {
      this.onChangeCallback(processedIds);
    }
  }

  private buildFilenameIndex(): Map<string, string[]> {
    const index = new Map<string, string[]>();
    for (const node of this.cache.getAllNodes()) {
      const basename = node.id.split('/').pop()!;
      const existing = index.get(basename) ?? [];
      existing.push(node.id);
      index.set(basename, existing);
    }
    // Sort each array alphabetically for deterministic first-match
    for (const paths of index.values()) {
      paths.sort();
    }
    return index;
  }

  private resolveOutgoingLinks(filenameIndex: Map<string, string[]>): void {
    // Build set of valid node IDs for quick lookup
    const validNodeIds = new Set<string>();
    for (const paths of filenameIndex.values()) {
      for (const path of paths) {
        validNodeIds.add(path);
      }
    }

    for (const node of this.cache.getAllNodes()) {
      const resolved = node.outgoingLinks.map((link) => {
        // If link already exists as a valid node ID, keep it
        if (validNodeIds.has(link)) {
          return link;
        }
        // Only resolve bare filenames (no path separators)
        // Partial paths like "folder/target.md" stay literal
        if (link.includes('/')) {
          return link;
        }
        // Try basename lookup for bare filenames
        const matches = filenameIndex.get(link);
        if (matches && matches.length > 0) {
          return matches[0]!;
        }
        return link;
      });

      // Only update if something changed
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

  private static readonly EXCLUDED_DIRS = new Set(['.roux', 'node_modules', '.git', '.obsidian']);

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
        if (DocStore.EXCLUDED_DIRS.has(entry.name)) {
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
   * - If it has a file extension, normalize as-is
   * - If no extension, add .md
   * - Lowercase, forward slashes
   */
  private normalizeWikiLink(target: string): string {
    let normalized = target.toLowerCase().replace(/\\/g, '/');

    // Add .md if no file extension present
    // File extension = dot followed by 1-4 alphanumeric chars at end
    if (!this.hasFileExtension(normalized)) {
      normalized += '.md';
    }

    return normalized;
  }

  private hasFileExtension(path: string): boolean {
    // Match common file extensions: .md, .txt, .png, .json, etc.
    // Extension must contain at least one letter (to exclude .2024, .123, etc.)
    const match = path.match(/\.([a-z0-9]{1,4})$/i);
    if (!match?.[1]) return false;
    // Require at least one letter in the extension
    return /[a-z]/i.test(match[1]);
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
