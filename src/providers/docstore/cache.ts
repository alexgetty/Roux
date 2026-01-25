import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import stringSimilarity from 'string-similarity';
import type { Node, SourceRef } from '../../types/node.js';
import type {
  TagMode,
  ListFilter,
  ListOptions,
  NodeSummary,
  ResolveOptions,
  ResolveResult,
} from '../../types/provider.js';

export interface EmbeddingRecord {
  model: string;
  vector: number[];
}

export interface CentralityRecord {
  pagerank: number;
  inDegree: number;
  outDegree: number;
  computedAt: number;
}

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

interface EmbeddingRow {
  node_id: string;
  model: string;
  vector: Buffer;
}

interface CentralityRow {
  node_id: string;
  pagerank: number;
  in_degree: number;
  out_degree: number;
  computed_at: number;
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

      CREATE TABLE IF NOT EXISTS embeddings (
        node_id TEXT PRIMARY KEY,
        model TEXT,
        vector BLOB,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS centrality (
        node_id TEXT PRIMARY KEY,
        pagerank REAL,
        in_degree INTEGER,
        out_degree INTEGER,
        computed_at INTEGER,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_nodes_source_path ON nodes(source_path);
    `);
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

  searchByTags(tags: string[], mode: TagMode): Node[] {
    if (tags.length === 0) return [];

    const allNodes = this.getAllNodes();
    const lowerTags = tags.map((t) => t.toLowerCase());

    return allNodes.filter((node) => {
      const nodeTags = node.tags.map((t) => t.toLowerCase());
      if (mode === 'any') {
        return lowerTags.some((t) => nodeTags.includes(t));
      } else {
        return lowerTags.every((t) => nodeTags.includes(t));
      }
    });
  }

  getModifiedTime(sourcePath: string): number | null {
    const row = this.db
      .prepare('SELECT source_modified FROM nodes WHERE source_path = ?')
      .get(sourcePath) as { source_modified: number } | undefined;

    return row?.source_modified ?? null;
  }

  getNodeByPath(sourcePath: string): Node | null {
    const row = this.db
      .prepare('SELECT * FROM nodes WHERE source_path = ?')
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

  listNodes(filter: ListFilter, options?: ListOptions): NodeSummary[] {
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
      conditions.push("id LIKE ? || '%'");
      params.push(filter.path);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT id, title FROM nodes ${whereClause} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = this.db.prepare(query).all(...params) as Array<{ id: string; title: string }>;

    return rows.map((row) => ({ id: row.id, title: row.title }));
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
    const candidates = this.listNodes(filter, { limit: 1000 });

    if (candidates.length === 0) {
      return names.map((query) => ({ query, match: null, score: 0 }));
    }

    const candidateTitles = candidates.map((c) => c.title.toLowerCase());
    const titleToId = new Map<string, string>();
    for (const c of candidates) {
      titleToId.set(c.title.toLowerCase(), c.id);
    }

    return names.map((query): ResolveResult => {
      const queryLower = query.toLowerCase();

      if (strategy === 'exact') {
        // Exact case-insensitive title match
        const matchedId = titleToId.get(queryLower);
        if (matchedId) {
          return { query, match: matchedId, score: 1 };
        }
        return { query, match: null, score: 0 };
      }

      // Fuzzy strategy using string-similarity
      if (strategy === 'fuzzy') {
        const result = stringSimilarity.findBestMatch(queryLower, candidateTitles);
        const bestMatch = result.bestMatch;

        if (bestMatch.rating >= threshold) {
          // bestMatch.target is guaranteed to exist in titleToId since both come from candidates
          const matchedId = titleToId.get(bestMatch.target)!;
          return { query, match: matchedId, score: bestMatch.rating };
        }
        return { query, match: null, score: 0 };
      }

      // Semantic strategy - not supported at cache level, return no match
      // DocStore will handle semantic by using embedding provider
      return { query, match: null, score: 0 };
    });
  }

  updateOutgoingLinks(nodeId: string, links: string[]): void {
    this.db
      .prepare('UPDATE nodes SET outgoing_links = ? WHERE id = ?')
      .run(JSON.stringify(links), nodeId);
  }

  storeEmbedding(nodeId: string, vector: number[], model: string): void {
    const buffer = Buffer.from(new Float32Array(vector).buffer);
    this.db
      .prepare(
        `
      INSERT INTO embeddings (node_id, model, vector)
      VALUES (?, ?, ?)
      ON CONFLICT(node_id) DO UPDATE SET
        model = excluded.model,
        vector = excluded.vector
    `
      )
      .run(nodeId, model, buffer);
  }

  getEmbedding(nodeId: string): EmbeddingRecord | null {
    const row = this.db
      .prepare('SELECT model, vector FROM embeddings WHERE node_id = ?')
      .get(nodeId) as EmbeddingRow | undefined;

    if (!row) return null;

    const float32 = new Float32Array(
      row.vector.buffer,
      row.vector.byteOffset,
      row.vector.length / 4
    );
    return {
      model: row.model,
      vector: Array.from(float32),
    };
  }

  storeCentrality(
    nodeId: string,
    pagerank: number,
    inDegree: number,
    outDegree: number,
    computedAt: number
  ): void {
    this.db
      .prepare(
        `
      INSERT INTO centrality (node_id, pagerank, in_degree, out_degree, computed_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(node_id) DO UPDATE SET
        pagerank = excluded.pagerank,
        in_degree = excluded.in_degree,
        out_degree = excluded.out_degree,
        computed_at = excluded.computed_at
    `
      )
      .run(nodeId, pagerank, inDegree, outDegree, computedAt);
  }

  getCentrality(nodeId: string): CentralityRecord | null {
    const row = this.db
      .prepare('SELECT * FROM centrality WHERE node_id = ?')
      .get(nodeId) as CentralityRow | undefined;

    if (!row) return null;

    return {
      pagerank: row.pagerank,
      inDegree: row.in_degree,
      outDegree: row.out_degree,
      computedAt: row.computed_at,
    };
  }

  getStats(): { nodeCount: number; embeddingCount: number; edgeCount: number } {
    const nodeCount = this.db
      .prepare('SELECT COUNT(*) as count FROM nodes')
      .get() as { count: number };

    const embeddingCount = this.db
      .prepare('SELECT COUNT(*) as count FROM embeddings')
      .get() as { count: number };

    // Sum all in_degree values to get edge count
    const edgeSum = this.db
      .prepare('SELECT SUM(in_degree) as total FROM centrality')
      .get() as { total: number | null };

    return {
      nodeCount: nodeCount.count,
      embeddingCount: embeddingCount.count,
      edgeCount: edgeSum.total ?? 0,
    };
  }

  clear(): void {
    this.db.exec('DELETE FROM centrality');
    this.db.exec('DELETE FROM embeddings');
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
