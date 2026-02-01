import { writeFile, mkdir, rm, stat } from 'node:fs/promises';
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
  parseMarkdown,
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
import { generateId } from './id.js';

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

  /** Pending unlinks waiting for potential rename detection (id -> metadata) */
  private pendingUnlinks = new Map<string, { path: string; timestamp: number }>();
  /** Time-to-live for pending unlinks before they're treated as real deletes */
  private readonly UNLINK_TTL_MS = 5000;

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
    // Pause watcher during sync to avoid processing our own writes
    if (this.fileWatcher?.isWatching()) {
      this.fileWatcher.pause();
    }

    try {
      const extensions = this.registry.getExtensions();
      const currentPaths = await collectFiles(this.sourceRoot, extensions);
      const trackedPaths = this.cache.getAllTrackedPaths();

      // Track IDs seen during this sync for duplicate detection
      const seenIds = new Map<string, string>(); // id -> first file path

      // Process new/modified files
      for (const filePath of currentPaths) {
        try {
          const mtime = await getFileMtime(filePath);
          const cachedMtime = this.cache.getModifiedTime(filePath);

          if (cachedMtime === null || mtime > cachedMtime) {
            const { node, needsIdWrite, newMtime } = await this.parseAndMaybeWriteId(filePath, mtime);

            // Check for duplicate ID
            const existingPath = seenIds.get(node.id);
            if (existingPath) {
              console.warn(
                `Duplicate ID ${node.id} found in ${filePath} (first seen in ${existingPath}):`,
                new Error('Skipping duplicate')
              );
              continue;
            }

            seenIds.set(node.id, filePath);

            // Use new mtime if we wrote back, otherwise original
            const finalMtime = needsIdWrite ? (newMtime ?? mtime) : mtime;
            this.cache.upsertNode(node, 'file', filePath, finalMtime);
          } else {
            // Even if not modified, track the ID for duplicate detection
            const existingNode = this.cache.getNodeByPath(filePath);
            if (existingNode) {
              const existingPath = seenIds.get(existingNode.id);
              /* v8 ignore next 7 - defensive code: unreachable due to PRIMARY KEY constraint on cache.nodes.id */
              if (existingPath) {
                console.warn(
                  `Duplicate ID ${existingNode.id} found in ${filePath} (first seen in ${existingPath}):`,
                  new Error('Skipping duplicate')
                );
                // Remove from cache since we're skipping this one
                this.cache.deleteNode(existingNode.id);
              } else {
                seenIds.set(existingNode.id, filePath);
              }
            }
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
    } finally {
      // Always resume watcher, even if sync fails
      if (this.fileWatcher?.isWatching()) {
        this.fileWatcher.resume();
      }
    }
  }

  async createNode(node: Node): Promise<void> {
    // Use node.id as file path, not as the stable ID
    const normalizedPath = normalizeId(node.id);
    validatePathWithinSource(this.sourceRoot, normalizedPath);

    const existingByPath = this.cache.getNodeByPath(join(this.sourceRoot, normalizedPath));
    if (existingByPath) {
      throw new Error(`Node already exists: ${normalizedPath}`);
    }

    const filePath = join(this.sourceRoot, normalizedPath);
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });

    // Generate fresh stable ID
    const stableId = generateId();

    const rawLinks = extractWikiLinks(node.content);
    const parsed = {
      id: stableId,
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
    const createdNode: Node = {
      ...node,
      id: stableId,
      outgoingLinks,
      sourceRef: {
        type: 'file',
        path: filePath,
        lastModified: new Date(mtime),
      },
    };
    this.cache.upsertNode(createdNode, 'file', filePath, mtime);

    // Resolve wikilinks and rebuild graph
    this.resolveAllLinks();
    await this.syncGraph();
  }

  async updateNode(id: string, updates: NodeUpdates): Promise<void> {
    // Try to find node by ID directly, by normalized path, or by source path
    let existing = this.cache.getNode(id);
    if (!existing) {
      const normalizedId = normalizeId(id);
      existing = this.cache.getNode(normalizedId);
    }
    /* v8 ignore next 4 - defensive: path-based fallback rarely reached with stable IDs */
    if (!existing && (id.includes('.') || id.includes('/'))) {
      const fullPath = join(this.sourceRoot, normalizeId(id));
      existing = this.cache.getNodeByPath(fullPath);
    }
    if (!existing) {
      throw new Error(`Node not found: ${id}`);
    }

    // Strip id from updates if present - original ID must be preserved
    const { ...safeUpdates } = updates;

    // Derive outgoingLinks from content (new or existing)
    const contentForLinks = safeUpdates.content ?? existing.content;
    const rawLinks = extractWikiLinks(contentForLinks);
    const outgoingLinks = rawLinks.map((link) => normalizeWikiLink(link));

    const updated: Node = {
      ...existing,
      ...safeUpdates,
      outgoingLinks,
      id: existing.id, // Preserve original ID
    };

    // Get file path from sourceRef (stable ID means path may differ from id)
    /* v8 ignore next - defensive: all DocStore nodes have sourceRef.path */
    const filePath = existing.sourceRef?.path ?? join(this.sourceRoot, existing.id);

    const parsed = {
      id: existing.id, // Write the stable ID back to frontmatter
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
    // Try to find node by ID directly, by normalized path, or by source path
    let existing = this.cache.getNode(id);
    if (!existing) {
      const normalizedId = normalizeId(id);
      existing = this.cache.getNode(normalizedId);
    }
    /* v8 ignore next 4 - defensive: path-based fallback rarely reached with stable IDs */
    if (!existing && (id.includes('.') || id.includes('/'))) {
      const fullPath = join(this.sourceRoot, normalizeId(id));
      existing = this.cache.getNodeByPath(fullPath);
    }
    if (!existing) {
      throw new Error(`Node not found: ${id}`);
    }

    // Get file path from sourceRef
    /* v8 ignore next - defensive: all DocStore nodes have sourceRef.path */
    const filePath = existing.sourceRef?.path ?? join(this.sourceRoot, existing.id);
    await rm(filePath);
    this.cache.deleteNode(existing.id);
    if (this.vectorIndex) await this.vectorIndex.delete(existing.id);

    // Rebuild graph without deleted node
    await this.syncGraph();
  }

  async getNode(id: string): Promise<Node | null> {
    // Try exact ID first (stable IDs are case-sensitive)
    let node = this.cache.getNode(id);
    if (node) return node;

    // Fall back to normalized ID for path-based lookups
    const normalizedId = normalizeId(id);
    /* v8 ignore next 4 - defensive: usually ID matches or doesn't exist */
    if (normalizedId !== id) {
      node = this.cache.getNode(normalizedId);
      if (node) return node;
    }

    // Try lookup by source path (for backwards compatibility with path-based queries)
    if (id.includes('.') || id.includes('/')) {
      const fullPath = join(this.sourceRoot, normalizedId);
      node = this.cache.getNodeByPath(fullPath);
    }

    return node;
  }

  async getNodes(ids: string[]): Promise<Node[]> {
    // Use getNode for each to leverage path-based fallback
    const results: Node[] = [];
    for (const id of ids) {
      const node = await this.getNode(id);
      if (node) results.push(node);
    }
    return results;
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
    const result = new Map<string, boolean>();
    for (const id of ids) {
      const node = await this.getNode(id);
      // Use normalized ID as key for consistency
      result.set(normalizeId(id), node !== null);
    }
    return result;
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
    // Pause watcher during batch processing to avoid triggering events from ID writebacks
    this.fileWatcher?.pause();

    const processedIds: string[] = [];
    const now = Date.now();

    try {
      // First pass: clean up expired pending vector deletes
      await this.cleanupExpiredUnlinks(now);

      // Second pass: collect unlinks and adds for this batch
      const batchUnlinks = new Map<string, string>(); // id -> path
      const batchAdds: Array<{ pathId: string; filePath: string }> = [];
      const batchChanges: Array<{ pathId: string; filePath: string }> = [];

      for (const [pathId, event] of events) {
        const filePath = join(this.sourceRoot, pathId);

        if (event === 'unlink') {
          const existing = this.cache.getNodeByPath(filePath);
          if (existing) {
            batchUnlinks.set(existing.id, filePath);
          }
        } else if (event === 'add') {
          batchAdds.push({ pathId, filePath });
        } else {
          batchChanges.push({ pathId, filePath });
        }
      }

      // Third pass: process adds, checking for renames from unlinks in this batch or pending
      for (const { pathId, filePath } of batchAdds) {
        try {
          const mtime = await getFileMtime(filePath);
          const { node, newMtime } = await this.parseAndMaybeWriteId(filePath, mtime);
          const finalMtime = newMtime ?? mtime;

          // Check if this is a rename from batch unlinks
          if (batchUnlinks.has(node.id)) {
            // RENAME within same batch: just update path, don't delete from cache/vector
            batchUnlinks.delete(node.id);
            // Fix #4: Pass mtime to updateSourcePath so content changes after rename are detected
            this.cache.updateSourcePath(node.id, filePath, finalMtime);
            this.cache.upsertNode(node, 'file', filePath, finalMtime);
            processedIds.push(node.id);
          } else if (this.pendingUnlinks.has(node.id)) {
            // RENAME across batches: file reappeared with same ID
            // Cancel the pending vector delete
            this.pendingUnlinks.delete(node.id);
            // Re-create the node in cache with new path
            this.cache.upsertNode(node, 'file', filePath, finalMtime);
            processedIds.push(node.id);
          } else {
            // NEW FILE: no pending unlink with matching ID
            // Check if there's an existing node with a different ID for this path
            const existingByPath = this.cache.getNodeByPath(filePath);
            if (existingByPath && existingByPath.id !== node.id) {
              this.cache.deleteNode(existingByPath.id);
              if (this.vectorIndex) {
                try {
                  await this.vectorIndex.delete(existingByPath.id);
                } catch {
                  // Ignore vector delete failures for cleanup
                }
              }
            }
            this.cache.upsertNode(node, 'file', filePath, finalMtime);
            processedIds.push(node.id);
          }
        } catch (err) {
          console.warn(`Failed to process file change for ${pathId}:`, err);
        }
      }

      // Fourth pass: process changes
      for (const { pathId, filePath } of batchChanges) {
        try {
          const mtime = await getFileMtime(filePath);
          const { node, newMtime } = await this.parseAndMaybeWriteId(filePath, mtime);
          const finalMtime = newMtime ?? mtime;

          const existingByPath = this.cache.getNodeByPath(filePath);
          if (existingByPath && existingByPath.id !== node.id) {
            this.cache.deleteNode(existingByPath.id);
            if (this.vectorIndex) {
              try {
                await this.vectorIndex.delete(existingByPath.id);
              } catch {
                // Ignore vector delete failures for cleanup
              }
            }
          }

          this.cache.upsertNode(node, 'file', filePath, finalMtime);
          processedIds.push(node.id);
        } catch (err) {
          console.warn(`Failed to process file change for ${pathId}:`, err);
        }
      }

      // Fifth pass: process remaining unlinks (not matched by adds in this batch)
      for (const [id, path] of batchUnlinks) {
        // Delete from cache immediately (existing behavior)
        this.cache.deleteNode(id);
        processedIds.push(id);

        // Queue for pending vector delete (deferred - might be a rename)
        // Vector delete happens after TTL if no matching add arrives
        this.pendingUnlinks.set(id, { path, timestamp: now });
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
    } finally {
      // Resume watcher after batch processing
      this.fileWatcher?.resume();
    }
  }

  /**
   * Clean up expired pending vector deletes.
   * These are real deletes (not renames) - safe to remove from vector index.
   */
  private async cleanupExpiredUnlinks(now: number): Promise<void> {
    for (const [id, entry] of this.pendingUnlinks) {
      if (now - entry.timestamp > this.UNLINK_TTL_MS) {
        // TTL expired - this was a real delete, not a rename
        // Note: cache.deleteNode already called when unlink was processed
        if (this.vectorIndex) {
          try {
            await this.vectorIndex.delete(id);
          } catch (vectorErr) {
            console.warn(`Vector delete failed for expired unlink ${id}:`, vectorErr);
          }
        }
        this.pendingUnlinks.delete(id);
      }
    }
  }

  private resolveAllLinks(): void {
    const nodes = this.cache.getAllNodes();

    // Build title-based index for wikilink resolution
    // buildFilenameIndex indexes by title (primary) and filename (fallback)
    const filenameIndex = buildFilenameIndex(nodes);
    const validNodeIds = new Set(nodes.map((n) => n.id));

    // Build path-to-ID mapping for partial path resolution (e.g., [[folder/note]])
    const pathToId = new Map<string, string>();
    for (const node of nodes) {
      if (node.sourceRef?.path) {
        const relativePath = relative(this.sourceRoot, node.sourceRef.path);
        const normalizedPath = normalizeId(relativePath);
        pathToId.set(normalizedPath, node.id);
      }
    }

    // Resolve links for each node
    for (const node of nodes) {
      const resolvedIds = resolveLinks(
        node.outgoingLinks,
        filenameIndex,
        validNodeIds
      );

      // Second pass: resolve any remaining paths (like "folder/target.md") to stable IDs
      const finalIds = resolvedIds.map((link) => {
        // If already a valid stable ID, keep it
        if (validNodeIds.has(link)) {
          return link;
        }
        // Try path-based lookup for partial paths
        const stableId = pathToId.get(link);
        return stableId ?? link;
      });

      if (finalIds.some((r, i) => r !== node.outgoingLinks[i])) {
        this.cache.updateOutgoingLinks(node.id, finalIds);
      }
    }
  }

  // ── Graph operations (override for path-based lookup) ─────

  async getNeighbors(id: string, options: { direction: 'in' | 'out' | 'both'; limit?: number }): Promise<Node[]> {
    // Resolve path to stable ID if needed
    const node = await this.getNode(id);
    if (!node) return [];
    return super.getNeighbors(node.id, options);
  }

  async findPath(source: string, target: string): Promise<string[] | null> {
    // Resolve paths to stable IDs
    const sourceNode = await this.getNode(source);
    const targetNode = await this.getNode(target);
    if (!sourceNode || !targetNode) return null;
    return super.findPath(sourceNode.id, targetNode.id);
  }

  async getHubs(metric: 'in_degree' | 'out_degree', limit: number): Promise<Array<[string, number]>> {
    return super.getHubs(metric, limit);
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
   * Parse a file and optionally write a generated ID back if missing.
   * Returns the node (with stable ID) and whether a write occurred.
   */
  private async parseAndMaybeWriteId(
    filePath: string,
    originalMtime: number
  ): Promise<{ node: Node; needsIdWrite: boolean; newMtime?: number }> {
    const content = await readFileContent(filePath);
    const relativePath = relative(this.sourceRoot, filePath);
    const ext = extname(filePath).toLowerCase();
    const actualMtime = new Date(originalMtime);

    const context: FileContext = {
      absolutePath: filePath,
      relativePath,
      extension: ext,
      mtime: actualMtime,
    };

    const { node, needsIdWrite } = this.registry.parse(content, context);

    if (!needsIdWrite) {
      return { node, needsIdWrite: false };
    }

    // Generate and write ID back to file
    const newId = generateId();
    const writebackSuccess = await this.writeIdBack(filePath, newId, originalMtime);

    if (!writebackSuccess) {
      // File was modified during sync, skip caching this file
      // Return the node but signal that caching should be skipped
      console.warn(`File modified during sync, skipping ID writeback: ${filePath}`);
      return { node, needsIdWrite: true };
    }

    // Update node with the new stable ID
    const updatedNode: Node = {
      ...node,
      id: newId,
    };

    // Get new mtime after write
    const newMtime = await getFileMtime(filePath);
    return { node: updatedNode, needsIdWrite: true, newMtime };
  }

  /**
   * Write a generated ID back to file's frontmatter.
   * Returns false if file was modified since originalMtime (race condition).
   *
   * Fix #3: Re-reads file content after mtime check to avoid TOCTOU race.
   * The file could change between the initial read and this write - using
   * stale content would lose any concurrent edits.
   */
  private async writeIdBack(
    filePath: string,
    nodeId: string,
    originalMtime: number
  ): Promise<boolean> {
    // Check if file was modified
    const currentStat = await stat(filePath);
    if (currentStat.mtimeMs !== originalMtime) {
      return false;
    }

    // Re-read content after mtime check passes (Fix #3: TOCTOU prevention)
    // This ensures we use the current file content, not a potentially stale copy
    const freshContent = await readFileContent(filePath);

    // Parse and update frontmatter
    const parsed = parseMarkdown(freshContent);
    parsed.id = nodeId;
    const newContent = serializeToMarkdown(parsed);
    await writeFile(filePath, newContent, 'utf-8');
    return true;
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
