import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { Node, SourceRef } from '../../types/node.js';
import type {
  TagMode,
  ListFilter,
  ListOptions,
  ListNodesResult,
  ResolveOptions,
  ResolveResult,
} from '../../types/provider.js';
import {
  type CentralityRecord,
  initCentralitySchema,
  storeCentrality,
  getCentrality,
  resolveNames,
} from './cache/index.js';

export type { CentralityRecord };

interface NodeRow {
  id: string;
  title: string;
  content: string;
  tags: string;
  outgoing_links: string;
  properties: string;
  source_type: string;
  source_path: string;
  source_modified: number;
}


export class Cache {
  private db: Database.Database;

  constructor(cacheDir: string) {
    mkdirSync(cacheDir, { recursive: true });
    const dbPath = join(cacheDir, 'cache.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    // Create nodes table (core schema owned by Cache)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        tags TEXT,
        outgoing_links TEXT,
        properties TEXT,
        source_type TEXT,
        source_path TEXT,
        source_modified INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_nodes_source_path ON nodes(source_path);
    `);

    // Delegate centrality schema to its module
    initCentralitySchema(this.db);

    // Enable foreign key enforcement for cascade deletes
    this.db.pragma('foreign_keys = ON');
  }

  getTableNames(): string[] {
    const rows = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    return rows.map((r) => r.name);
  }

  upsertNode(
    node: Node,
    sourceType: string,
    sourcePath: string,
    sourceModified: number
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO nodes (id, title, content, tags, outgoing_links, properties, source_type, source_path, source_modified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        tags = excluded.tags,
        outgoing_links = excluded.outgoing_links,
        properties = excluded.properties,
        source_type = excluded.source_type,
        source_path = excluded.source_path,
        source_modified = excluded.source_modified
    `);

    stmt.run(
      node.id,
      node.title,
      node.content,
      JSON.stringify(node.tags),
      JSON.stringify(node.outgoingLinks),
      JSON.stringify(node.properties),
      sourceType,
      sourcePath,
      sourceModified
    );
  }

  getNode(id: string): Node | null {
    const row = this.db
      .prepare('SELECT * FROM nodes WHERE id = ?')
      .get(id) as NodeRow | undefined;

    if (!row) return null;
    return this.rowToNode(row);
  }

  getNodes(ids: string[]): Node[] {
    if (ids.length === 0) return [];

    // Fetch all nodes then order by input ids
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT * FROM nodes WHERE id IN (${placeholders})`)
      .all(...ids) as NodeRow[];

    const nodeMap = new Map<string, Node>();
    for (const row of rows) {
      nodeMap.set(row.id, this.rowToNode(row));
    }

    // Return in requested order
    const result: Node[] = [];
    for (const id of ids) {
      const node = nodeMap.get(id);
      if (node) result.push(node);
    }
    return result;
  }

  deleteNode(id: string): void {
    this.db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
  }

  getAllNodes(): Node[] {
    const rows = this.db.prepare('SELECT * FROM nodes').all() as NodeRow[];
    return rows.map((row) => this.rowToNode(row));
  }

  searchByTags(tags: string[], mode: TagMode, limit?: number): Node[] {
    if (tags.length === 0) return [];

    const lowerTags = tags.map((t) => t.toLowerCase());

    // Build SQL query with tag filtering in the database
    // Tags are stored as JSON array, so we use json_each to search
    let query: string;
    const params: unknown[] = [];

    if (mode === 'any') {
      // Match nodes that have ANY of the specified tags
      const tagConditions = lowerTags.map(() =>
        "EXISTS (SELECT 1 FROM json_each(tags) WHERE LOWER(json_each.value) = ?)"
      ).join(' OR ');
      query = `SELECT * FROM nodes WHERE ${tagConditions}`;
      params.push(...lowerTags);
    } else {
      // Match nodes that have ALL of the specified tags
      const tagConditions = lowerTags.map(() =>
        "EXISTS (SELECT 1 FROM json_each(tags) WHERE LOWER(json_each.value) = ?)"
      ).join(' AND ');
      query = `SELECT * FROM nodes WHERE ${tagConditions}`;
      params.push(...lowerTags);
    }

    if (limit !== undefined) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const rows = this.db.prepare(query).all(...params) as NodeRow[];
    return rows.map((row) => this.rowToNode(row));
  }

  getModifiedTime(sourcePath: string): number | null {
    const row = this.db
      .prepare('SELECT source_modified FROM nodes WHERE source_path = ?')
      .get(sourcePath) as { source_modified: number } | undefined;

    return row?.source_modified ?? null;
  }

  getNodeByPath(sourcePath: string): Node | null {
    // Case-insensitive path lookup for cross-platform compatibility
    const row = this.db
      .prepare('SELECT * FROM nodes WHERE LOWER(source_path) = LOWER(?)')
      .get(sourcePath) as NodeRow | undefined;

    if (!row) return null;
    return this.rowToNode(row);
  }

  getAllTrackedPaths(): Set<string> {
    const rows = this.db
      .prepare('SELECT source_path FROM nodes')
      .all() as Array<{ source_path: string }>;

    return new Set(rows.map((r) => r.source_path));
  }

  /**
   * Update source path for a node, optionally updating mtime too.
   *
   * Fix #4: When mtime is provided, updates source_modified so that
   * content changes after rename are detected on next sync.
   */
  updateSourcePath(id: string, newPath: string, mtime?: number): void {
    if (mtime !== undefined) {
      this.db
        .prepare('UPDATE nodes SET source_path = ?, source_modified = ? WHERE id = ?')
        .run(newPath, mtime, id);
    } else {
      this.db
        .prepare('UPDATE nodes SET source_path = ? WHERE id = ?')
        .run(newPath, id);
    }
  }

  getIdByPath(sourcePath: string): string | null {
    const row = this.db
      .prepare('SELECT id FROM nodes WHERE source_path = ?')
      .get(sourcePath) as { id: string } | undefined;

    return row?.id ?? null;
  }

  resolveTitles(ids: string[]): Map<string, string> {
    if (ids.length === 0) return new Map();

    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT id, title FROM nodes WHERE id IN (${placeholders})`)
      .all(...ids) as Array<{ id: string; title: string }>;

    const result = new Map<string, string>();
    for (const row of rows) {
      result.set(row.id, row.title);
    }
    return result;
  }

  nodesExist(ids: string[]): Map<string, boolean> {
    if (ids.length === 0) return new Map();

    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT id FROM nodes WHERE id IN (${placeholders})`)
      .all(...ids) as Array<{ id: string }>;

    const existingIds = new Set(rows.map((r) => r.id));
    const result = new Map<string, boolean>();
    for (const id of ids) {
      result.set(id, existingIds.has(id));
    }
    return result;
  }

  listNodes(filter: ListFilter, options?: ListOptions): ListNodesResult {
    const limit = Math.min(options?.limit ?? 100, 1000);
    const offset = options?.offset ?? 0;

    // Build query dynamically based on filters
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.tag) {
      // Case-insensitive tag match - tags stored as JSON array
      conditions.push("EXISTS (SELECT 1 FROM json_each(tags) WHERE LOWER(json_each.value) = LOWER(?))");
      params.push(filter.tag);
    }

    if (filter.path) {
      // Filter by source_path since node id is now a stable nanoid
      conditions.push("LOWER(source_path) LIKE '%' || LOWER(?) || '%'");
      params.push(filter.path);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count of matching nodes (without limit/offset)
    const countQuery = `SELECT COUNT(*) as count FROM nodes ${whereClause}`;
    const countRow = this.db.prepare(countQuery).get(...params) as { count: number };
    const total = countRow.count;

    // Get paginated results
    const query = `SELECT id, title FROM nodes ${whereClause} LIMIT ? OFFSET ?`;
    const rows = this.db.prepare(query).all(...params, limit, offset) as Array<{ id: string; title: string }>;

    const nodes = rows.map((row) => ({ id: row.id, title: row.title }));
    return { nodes, total };
  }

  resolveNodes(names: string[], options?: ResolveOptions): ResolveResult[] {
    if (names.length === 0) return [];

    const strategy = options?.strategy ?? 'fuzzy';
    const threshold = options?.threshold ?? 0.7;

    // Build filter without undefined values
    const filter: ListFilter = {};
    if (options?.tag) filter.tag = options.tag;
    if (options?.path) filter.path = options.path;

    // Get candidate nodes (applying tag/path filters)
    const { nodes: candidates } = this.listNodes(filter, { limit: 1000 });

    return resolveNames(names, candidates, { strategy, threshold });
  }

  updateOutgoingLinks(nodeId: string, links: string[]): void {
    this.db
      .prepare('UPDATE nodes SET outgoing_links = ? WHERE id = ?')
      .run(JSON.stringify(links), nodeId);
  }

  storeCentrality(
    nodeId: string,
    pagerank: number,
    inDegree: number,
    outDegree: number,
    computedAt: number
  ): void {
    storeCentrality(this.db, nodeId, pagerank, inDegree, outDegree, computedAt);
  }

  getCentrality(nodeId: string): CentralityRecord | null {
    return getCentrality(this.db, nodeId);
  }

  getStats(): { nodeCount: number; edgeCount: number } {
    const nodeCount = this.db
      .prepare('SELECT COUNT(*) as count FROM nodes')
      .get() as { count: number };

    // Sum all in_degree values to get edge count
    const edgeSum = this.db
      .prepare('SELECT SUM(in_degree) as total FROM centrality')
      .get() as { total: number | null };

    return {
      nodeCount: nodeCount.count,
      edgeCount: edgeSum.total ?? 0,
    };
  }

  clear(): void {
    this.db.exec('DELETE FROM centrality');
    this.db.exec('DELETE FROM nodes');
  }

  close(): void {
    this.db.close();
  }

  private rowToNode(row: NodeRow): Node {
    const sourceRef: SourceRef = {
      type: row.source_type as SourceRef['type'],
      path: row.source_path,
      lastModified: new Date(row.source_modified),
    };

    return {
      id: row.id,
      title: row.title,
      content: row.content,
      tags: JSON.parse(row.tags) as string[],
      outgoingLinks: JSON.parse(row.outgoing_links) as string[],
      properties: JSON.parse(row.properties) as Record<string, unknown>,
      sourceRef,
    };
  }
}
