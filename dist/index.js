var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/string-similarity/src/index.js
var require_src = __commonJS({
  "node_modules/string-similarity/src/index.js"(exports, module) {
    "use strict";
    module.exports = {
      compareTwoStrings,
      findBestMatch
    };
    function compareTwoStrings(first, second) {
      first = first.replace(/\s+/g, "");
      second = second.replace(/\s+/g, "");
      if (first === second) return 1;
      if (first.length < 2 || second.length < 2) return 0;
      let firstBigrams = /* @__PURE__ */ new Map();
      for (let i = 0; i < first.length - 1; i++) {
        const bigram = first.substring(i, i + 2);
        const count = firstBigrams.has(bigram) ? firstBigrams.get(bigram) + 1 : 1;
        firstBigrams.set(bigram, count);
      }
      ;
      let intersectionSize = 0;
      for (let i = 0; i < second.length - 1; i++) {
        const bigram = second.substring(i, i + 2);
        const count = firstBigrams.has(bigram) ? firstBigrams.get(bigram) : 0;
        if (count > 0) {
          firstBigrams.set(bigram, count - 1);
          intersectionSize++;
        }
      }
      return 2 * intersectionSize / (first.length + second.length - 2);
    }
    function findBestMatch(mainString, targetStrings) {
      if (!areArgsValid(mainString, targetStrings)) throw new Error("Bad arguments: First argument should be a string, second should be an array of strings");
      const ratings = [];
      let bestMatchIndex = 0;
      for (let i = 0; i < targetStrings.length; i++) {
        const currentTargetString = targetStrings[i];
        const currentRating = compareTwoStrings(mainString, currentTargetString);
        ratings.push({ target: currentTargetString, rating: currentRating });
        if (currentRating > ratings[bestMatchIndex].rating) {
          bestMatchIndex = i;
        }
      }
      const bestMatch = ratings[bestMatchIndex];
      return { ratings, bestMatch, bestMatchIndex };
    }
    function areArgsValid(mainString, targetStrings) {
      if (typeof mainString !== "string") return false;
      if (!Array.isArray(targetStrings)) return false;
      if (!targetStrings.length) return false;
      if (targetStrings.find(function(s) {
        return typeof s !== "string";
      })) return false;
      return true;
    }
  }
});

// src/types/node.ts
function isNode(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value;
  return typeof obj["id"] === "string" && typeof obj["title"] === "string" && typeof obj["content"] === "string" && Array.isArray(obj["tags"]) && obj["tags"].every((t) => typeof t === "string") && Array.isArray(obj["outgoingLinks"]) && obj["outgoingLinks"].every((l) => typeof l === "string") && typeof obj["properties"] === "object" && obj["properties"] !== null;
}
function isSourceRef(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value;
  const validTypes = ["file", "api", "manual"];
  return typeof obj["type"] === "string" && validTypes.includes(obj["type"]) && (obj["path"] === void 0 || typeof obj["path"] === "string") && (obj["lastModified"] === void 0 || obj["lastModified"] instanceof Date);
}

// src/types/provider.ts
function isVectorIndex(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const obj = value;
  return typeof obj.store === "function" && typeof obj.search === "function" && typeof obj.delete === "function" && typeof obj.getModel === "function" && typeof obj.hasEmbedding === "function";
}

// src/types/config.ts
var DEFAULT_CONFIG = {
  source: {
    path: ".",
    include: ["*.md"],
    exclude: []
  },
  cache: {
    path: ".roux/"
  },
  system: {
    onModelChange: "lazy"
  },
  providers: {
    store: {
      type: "docstore"
    }
  }
};

// src/providers/docstore/index.ts
import { writeFile, mkdir, rm } from "fs/promises";
import { mkdirSync as mkdirSync2 } from "fs";
import { join as join4, relative as relative2, dirname, extname as extname3 } from "path";

// src/graph/builder.ts
import { DirectedGraph } from "graphology";
function buildGraph(nodes) {
  const graph = new DirectedGraph();
  const nodeIds = /* @__PURE__ */ new Set();
  for (const node of nodes) {
    graph.addNode(node.id);
    nodeIds.add(node.id);
  }
  for (const node of nodes) {
    const seen = /* @__PURE__ */ new Set();
    for (const target of node.outgoingLinks) {
      if (!nodeIds.has(target) || seen.has(target)) {
        continue;
      }
      seen.add(target);
      graph.addDirectedEdge(node.id, target);
    }
  }
  return graph;
}

// src/graph/traversal.ts
import { bidirectional } from "graphology-shortest-path";

// src/utils/heap.ts
var MinHeap = class {
  data = [];
  compare;
  constructor(comparator) {
    this.compare = comparator;
  }
  size() {
    return this.data.length;
  }
  peek() {
    return this.data[0];
  }
  push(value) {
    this.data.push(value);
    this.bubbleUp(this.data.length - 1);
  }
  pop() {
    if (this.data.length === 0) return void 0;
    if (this.data.length === 1) return this.data.pop();
    const min = this.data[0];
    this.data[0] = this.data.pop();
    this.bubbleDown(0);
    return min;
  }
  toArray() {
    return [...this.data];
  }
  bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compare(this.data[index], this.data[parentIndex]) >= 0) {
        break;
      }
      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }
  bubbleDown(index) {
    const length = this.data.length;
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;
      if (leftChild < length && this.compare(this.data[leftChild], this.data[smallest]) < 0) {
        smallest = leftChild;
      }
      if (rightChild < length && this.compare(this.data[rightChild], this.data[smallest]) < 0) {
        smallest = rightChild;
      }
      if (smallest === index) break;
      this.swap(index, smallest);
      index = smallest;
    }
  }
  swap(i, j) {
    const temp = this.data[i];
    this.data[i] = this.data[j];
    this.data[j] = temp;
  }
};

// src/graph/traversal.ts
function getNeighborIds(graph, id, options) {
  if (!graph.hasNode(id)) {
    return [];
  }
  let neighbors;
  switch (options.direction) {
    case "in":
      neighbors = graph.inNeighbors(id);
      break;
    case "out":
      neighbors = graph.outNeighbors(id);
      break;
    case "both":
      neighbors = graph.neighbors(id);
      break;
  }
  if (options.limit !== void 0) {
    if (options.limit <= 0) {
      return [];
    }
    if (options.limit < neighbors.length) {
      return neighbors.slice(0, options.limit);
    }
  }
  return neighbors;
}
function findPath(graph, source, target) {
  if (!graph.hasNode(source) || !graph.hasNode(target)) {
    return null;
  }
  if (source === target) {
    return [source];
  }
  const path = bidirectional(graph, source, target);
  return path;
}
function getHubs(graph, metric, limit) {
  if (limit <= 0) {
    return [];
  }
  const heap = new MinHeap((a, b) => a[1] - b[1]);
  graph.forEachNode((id) => {
    const score = metric === "in_degree" ? graph.inDegree(id) : graph.outDegree(id);
    if (heap.size() < limit) {
      heap.push([id, score]);
    } else if (score > heap.peek()[1]) {
      heap.pop();
      heap.push([id, score]);
    }
  });
  return heap.toArray().sort((a, b) => b[1] - a[1]);
}

// src/graph/analysis.ts
function computeCentrality(graph) {
  const result = /* @__PURE__ */ new Map();
  graph.forEachNode((id) => {
    result.set(id, {
      inDegree: graph.inDegree(id),
      outDegree: graph.outDegree(id)
    });
  });
  return result;
}

// src/graph/manager.ts
var GraphNotReadyError = class extends Error {
  constructor() {
    super("Graph not built. Call build() before querying.");
    this.name = "GraphNotReadyError";
  }
};
var GraphManager = class {
  graph = null;
  /** Build graph and return centrality metrics. Caller stores as needed. */
  build(nodes) {
    this.graph = buildGraph(nodes);
    return computeCentrality(this.graph);
  }
  /** Throws GraphNotReadyError if not built. Returns graph for query use. */
  assertReady() {
    if (!this.graph) throw new GraphNotReadyError();
    return this.graph;
  }
  isReady() {
    return this.graph !== null;
  }
  getNeighborIds(id, options) {
    return getNeighborIds(this.assertReady(), id, options);
  }
  findPath(source, target) {
    return findPath(this.assertReady(), source, target);
  }
  getHubs(metric, limit) {
    return getHubs(this.assertReady(), metric, limit);
  }
};

// src/providers/store/resolve.ts
var import_string_similarity = __toESM(require_src(), 1);
function resolveNames(names, candidates, options) {
  if (names.length === 0) return [];
  const { strategy, threshold } = options;
  if (candidates.length === 0) {
    return names.map((query) => ({ query, match: null, score: 0 }));
  }
  const candidateTitles = candidates.map((c) => c.title.toLowerCase());
  const titleToId = /* @__PURE__ */ new Map();
  for (const c of candidates) {
    titleToId.set(c.title.toLowerCase(), c.id);
  }
  return names.map((query) => {
    const queryLower = query.toLowerCase();
    if (strategy === "exact") {
      const matchedId = titleToId.get(queryLower);
      if (matchedId) {
        return { query, match: matchedId, score: 1 };
      }
      return { query, match: null, score: 0 };
    }
    if (strategy === "fuzzy") {
      const result = import_string_similarity.default.findBestMatch(queryLower, candidateTitles);
      const bestMatch = result.bestMatch;
      if (bestMatch.rating >= threshold) {
        const matchedId = titleToId.get(bestMatch.target);
        return { query, match: matchedId, score: bestMatch.rating };
      }
      return { query, match: null, score: 0 };
    }
    return { query, match: null, score: 0 };
  });
}

// src/providers/store/index.ts
var StoreProvider = class {
  graphManager = new GraphManager();
  vectorIndex;
  constructor(options) {
    this.vectorIndex = options?.vectorIndex ?? null;
  }
  // ── Graph operations (delegate to GraphManager) ────────────
  async getNeighbors(id, options) {
    if (!this.graphManager.isReady()) return [];
    const neighborIds = this.graphManager.getNeighborIds(id, options);
    return this.getNodesByIds(neighborIds);
  }
  async findPath(source, target) {
    if (!this.graphManager.isReady()) return null;
    return this.graphManager.findPath(source, target);
  }
  async getHubs(metric, limit) {
    if (!this.graphManager.isReady()) return [];
    return this.graphManager.getHubs(metric, limit);
  }
  // ── Vector operations (delegate to VectorIndex) ────────────
  async storeEmbedding(id, vector, model) {
    if (!this.vectorIndex) throw new Error("No VectorIndex configured");
    return this.vectorIndex.store(id, vector, model);
  }
  async searchByVector(vector, limit) {
    if (!this.vectorIndex) throw new Error("No VectorIndex configured");
    return this.vectorIndex.search(vector, limit);
  }
  // ── Discovery ──────────────────────────────────────────────
  async getRandomNode(tags) {
    let candidates;
    if (tags && tags.length > 0) {
      candidates = await this.searchByTags(tags, "any");
    } else {
      candidates = await this.loadAllNodes();
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  // ── Default implementations (overridable) ──────────────────
  async searchByTags(tags, mode, limit) {
    const allNodes = await this.loadAllNodes();
    const lowerTags = tags.map((t) => t.toLowerCase());
    let results = allNodes.filter((node) => {
      const nodeTags = node.tags.map((t) => t.toLowerCase());
      return mode === "any" ? lowerTags.some((t) => nodeTags.includes(t)) : lowerTags.every((t) => nodeTags.includes(t));
    });
    if (limit !== void 0) results = results.slice(0, limit);
    return results;
  }
  async listNodes(filter, options) {
    let nodes = await this.loadAllNodes();
    if (filter.tag) {
      const lower = filter.tag.toLowerCase();
      nodes = nodes.filter((n) => n.tags.some((t) => t.toLowerCase() === lower));
    }
    if (filter.path) {
      nodes = nodes.filter((n) => n.id.startsWith(filter.path));
    }
    const total = nodes.length;
    const offset = options?.offset ?? 0;
    const limit = Math.min(options?.limit ?? 100, 1e3);
    const sliced = nodes.slice(offset, offset + limit);
    return {
      nodes: sliced.map((n) => ({ id: n.id, title: n.title })),
      total
    };
  }
  async nodesExist(ids) {
    if (ids.length === 0) return /* @__PURE__ */ new Map();
    const found = await this.getNodesByIds(ids);
    const foundIds = new Set(found.map((n) => n.id));
    const result = /* @__PURE__ */ new Map();
    for (const id of ids) {
      result.set(id, foundIds.has(id));
    }
    return result;
  }
  async resolveTitles(ids) {
    if (ids.length === 0) return /* @__PURE__ */ new Map();
    const nodes = await this.getNodesByIds(ids);
    const result = /* @__PURE__ */ new Map();
    for (const node of nodes) {
      result.set(node.id, node.title);
    }
    return result;
  }
  async resolveNodes(names, options) {
    const strategy = options?.strategy ?? "fuzzy";
    if (strategy === "semantic") {
      return names.map((query) => ({ query, match: null, score: 0 }));
    }
    const allNodes = await this.loadAllNodes();
    let candidates = allNodes.map((n) => ({ id: n.id, title: n.title }));
    if (options?.tag) {
      const lower = options.tag.toLowerCase();
      const filtered = allNodes.filter((n) => n.tags.some((t) => t.toLowerCase() === lower));
      candidates = filtered.map((n) => ({ id: n.id, title: n.title }));
    }
    if (options?.path) {
      candidates = candidates.filter((c) => c.id.startsWith(options.path));
    }
    return resolveNames(names, candidates, {
      strategy,
      threshold: options?.threshold ?? 0.7
    });
  }
  // ── Graph lifecycle ────────────────────────────────────────
  async syncGraph() {
    const nodes = await this.loadAllNodes();
    const centrality = this.graphManager.build(nodes);
    this.onCentralityComputed(centrality);
  }
  onCentralityComputed(_centrality) {
  }
};

// src/providers/docstore/cache.ts
import Database from "better-sqlite3";
import { join } from "path";
import { mkdirSync } from "fs";

// src/providers/docstore/cache/embeddings.ts
function storeEmbedding(db, nodeId, vector, model) {
  const buffer = Buffer.from(new Float32Array(vector).buffer);
  db.prepare(
    `
    INSERT INTO embeddings (node_id, model, vector)
    VALUES (?, ?, ?)
    ON CONFLICT(node_id) DO UPDATE SET
      model = excluded.model,
      vector = excluded.vector
  `
  ).run(nodeId, model, buffer);
}
function getEmbedding(db, nodeId) {
  const row = db.prepare("SELECT model, vector FROM embeddings WHERE node_id = ?").get(nodeId);
  if (!row) return null;
  const float32 = new Float32Array(
    row.vector.buffer,
    row.vector.byteOffset,
    row.vector.length / 4
  );
  return {
    model: row.model,
    vector: Array.from(float32)
  };
}

// src/providers/docstore/cache/centrality.ts
function storeCentrality(db, nodeId, pagerank, inDegree, outDegree, computedAt) {
  db.prepare(
    `
    INSERT INTO centrality (node_id, pagerank, in_degree, out_degree, computed_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(node_id) DO UPDATE SET
      pagerank = excluded.pagerank,
      in_degree = excluded.in_degree,
      out_degree = excluded.out_degree,
      computed_at = excluded.computed_at
  `
  ).run(nodeId, pagerank, inDegree, outDegree, computedAt);
}
function getCentrality(db, nodeId) {
  const row = db.prepare("SELECT * FROM centrality WHERE node_id = ?").get(nodeId);
  if (!row) return null;
  return {
    pagerank: row.pagerank,
    inDegree: row.in_degree,
    outDegree: row.out_degree,
    computedAt: row.computed_at
  };
}

// src/providers/docstore/cache.ts
var Cache = class {
  db;
  constructor(cacheDir) {
    mkdirSync(cacheDir, { recursive: true });
    const dbPath = join(cacheDir, "cache.db");
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initSchema();
  }
  initSchema() {
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
    this.db.pragma("foreign_keys = ON");
  }
  getTableNames() {
    const rows = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    return rows.map((r) => r.name);
  }
  upsertNode(node, sourceType, sourcePath, sourceModified) {
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
  getNode(id) {
    const row = this.db.prepare("SELECT * FROM nodes WHERE id = ?").get(id);
    if (!row) return null;
    return this.rowToNode(row);
  }
  getNodes(ids) {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(",");
    const rows = this.db.prepare(`SELECT * FROM nodes WHERE id IN (${placeholders})`).all(...ids);
    const nodeMap = /* @__PURE__ */ new Map();
    for (const row of rows) {
      nodeMap.set(row.id, this.rowToNode(row));
    }
    const result = [];
    for (const id of ids) {
      const node = nodeMap.get(id);
      if (node) result.push(node);
    }
    return result;
  }
  deleteNode(id) {
    this.db.prepare("DELETE FROM nodes WHERE id = ?").run(id);
  }
  getAllNodes() {
    const rows = this.db.prepare("SELECT * FROM nodes").all();
    return rows.map((row) => this.rowToNode(row));
  }
  searchByTags(tags, mode, limit) {
    if (tags.length === 0) return [];
    const lowerTags = tags.map((t) => t.toLowerCase());
    let query;
    const params = [];
    if (mode === "any") {
      const tagConditions = lowerTags.map(
        () => "EXISTS (SELECT 1 FROM json_each(tags) WHERE LOWER(json_each.value) = ?)"
      ).join(" OR ");
      query = `SELECT * FROM nodes WHERE ${tagConditions}`;
      params.push(...lowerTags);
    } else {
      const tagConditions = lowerTags.map(
        () => "EXISTS (SELECT 1 FROM json_each(tags) WHERE LOWER(json_each.value) = ?)"
      ).join(" AND ");
      query = `SELECT * FROM nodes WHERE ${tagConditions}`;
      params.push(...lowerTags);
    }
    if (limit !== void 0) {
      query += " LIMIT ?";
      params.push(limit);
    }
    const rows = this.db.prepare(query).all(...params);
    return rows.map((row) => this.rowToNode(row));
  }
  getModifiedTime(sourcePath) {
    const row = this.db.prepare("SELECT source_modified FROM nodes WHERE source_path = ?").get(sourcePath);
    return row?.source_modified ?? null;
  }
  getNodeByPath(sourcePath) {
    const row = this.db.prepare("SELECT * FROM nodes WHERE source_path = ?").get(sourcePath);
    if (!row) return null;
    return this.rowToNode(row);
  }
  getAllTrackedPaths() {
    const rows = this.db.prepare("SELECT source_path FROM nodes").all();
    return new Set(rows.map((r) => r.source_path));
  }
  resolveTitles(ids) {
    if (ids.length === 0) return /* @__PURE__ */ new Map();
    const placeholders = ids.map(() => "?").join(",");
    const rows = this.db.prepare(`SELECT id, title FROM nodes WHERE id IN (${placeholders})`).all(...ids);
    const result = /* @__PURE__ */ new Map();
    for (const row of rows) {
      result.set(row.id, row.title);
    }
    return result;
  }
  nodesExist(ids) {
    if (ids.length === 0) return /* @__PURE__ */ new Map();
    const placeholders = ids.map(() => "?").join(",");
    const rows = this.db.prepare(`SELECT id FROM nodes WHERE id IN (${placeholders})`).all(...ids);
    const existingIds = new Set(rows.map((r) => r.id));
    const result = /* @__PURE__ */ new Map();
    for (const id of ids) {
      result.set(id, existingIds.has(id));
    }
    return result;
  }
  listNodes(filter, options) {
    const limit = Math.min(options?.limit ?? 100, 1e3);
    const offset = options?.offset ?? 0;
    const conditions = [];
    const params = [];
    if (filter.tag) {
      conditions.push("EXISTS (SELECT 1 FROM json_each(tags) WHERE LOWER(json_each.value) = LOWER(?))");
      params.push(filter.tag);
    }
    if (filter.path) {
      conditions.push("id LIKE ? || '%'");
      params.push(filter.path);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const countQuery = `SELECT COUNT(*) as count FROM nodes ${whereClause}`;
    const countRow = this.db.prepare(countQuery).get(...params);
    const total = countRow.count;
    const query = `SELECT id, title FROM nodes ${whereClause} LIMIT ? OFFSET ?`;
    const rows = this.db.prepare(query).all(...params, limit, offset);
    const nodes = rows.map((row) => ({ id: row.id, title: row.title }));
    return { nodes, total };
  }
  resolveNodes(names, options) {
    if (names.length === 0) return [];
    const strategy = options?.strategy ?? "fuzzy";
    const threshold = options?.threshold ?? 0.7;
    const filter = {};
    if (options?.tag) filter.tag = options.tag;
    if (options?.path) filter.path = options.path;
    const { nodes: candidates } = this.listNodes(filter, { limit: 1e3 });
    return resolveNames(names, candidates, { strategy, threshold });
  }
  updateOutgoingLinks(nodeId, links) {
    this.db.prepare("UPDATE nodes SET outgoing_links = ? WHERE id = ?").run(JSON.stringify(links), nodeId);
  }
  storeEmbedding(nodeId, vector, model) {
    storeEmbedding(this.db, nodeId, vector, model);
  }
  getEmbedding(nodeId) {
    return getEmbedding(this.db, nodeId);
  }
  storeCentrality(nodeId, pagerank, inDegree, outDegree, computedAt) {
    storeCentrality(this.db, nodeId, pagerank, inDegree, outDegree, computedAt);
  }
  getCentrality(nodeId) {
    return getCentrality(this.db, nodeId);
  }
  getStats() {
    const nodeCount = this.db.prepare("SELECT COUNT(*) as count FROM nodes").get();
    const embeddingCount = this.db.prepare("SELECT COUNT(*) as count FROM embeddings").get();
    const edgeSum = this.db.prepare("SELECT SUM(in_degree) as total FROM centrality").get();
    return {
      nodeCount: nodeCount.count,
      embeddingCount: embeddingCount.count,
      edgeCount: edgeSum.total ?? 0
    };
  }
  clear() {
    this.db.exec("DELETE FROM centrality");
    this.db.exec("DELETE FROM embeddings");
    this.db.exec("DELETE FROM nodes");
  }
  close() {
    this.db.close();
  }
  rowToNode(row) {
    const sourceRef = {
      type: row.source_type,
      path: row.source_path,
      lastModified: new Date(row.source_modified)
    };
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      tags: JSON.parse(row.tags),
      outgoingLinks: JSON.parse(row.outgoing_links),
      properties: JSON.parse(row.properties),
      sourceRef
    };
  }
};

// src/providers/vector/sqlite.ts
import Database2 from "better-sqlite3";
import { join as join2 } from "path";

// src/utils/math.ts
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
function cosineDistance(a, b) {
  const similarity = cosineSimilarity(a, b);
  if (similarity === 0 && (isZeroVector(a) || isZeroVector(b))) {
    return 1;
  }
  return 1 - similarity;
}
function isZeroVector(v) {
  for (let i = 0; i < v.length; i++) {
    if (v[i] !== 0) return false;
  }
  return true;
}

// src/providers/vector/sqlite.ts
var SqliteVectorIndex = class {
  db;
  ownsDb;
  constructor(pathOrDb) {
    if (typeof pathOrDb === "string") {
      this.db = new Database2(join2(pathOrDb, "vectors.db"));
      this.ownsDb = true;
    } else {
      this.db = pathOrDb;
      this.ownsDb = false;
    }
    this.init();
  }
  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vectors (
        id TEXT PRIMARY KEY,
        model TEXT NOT NULL,
        vector BLOB NOT NULL
      )
    `);
  }
  async store(id, vector, model) {
    if (vector.length === 0) {
      throw new Error("Cannot store empty vector");
    }
    for (const v of vector) {
      if (!Number.isFinite(v)) {
        throw new Error(`Invalid vector value: ${v}`);
      }
    }
    const existing = this.db.prepare("SELECT LENGTH(vector) / 4 as dim FROM vectors WHERE id != ? LIMIT 1").get(id);
    if (existing && existing.dim !== vector.length) {
      throw new Error(
        `Dimension mismatch: cannot store ${vector.length}-dim vector, existing vectors have ${existing.dim} dimensions`
      );
    }
    const blob = Buffer.from(new Float32Array(vector).buffer);
    this.db.prepare(
      `INSERT OR REPLACE INTO vectors (id, model, vector) VALUES (?, ?, ?)`
    ).run(id, model, blob);
  }
  async search(vector, limit) {
    if (vector.length === 0) {
      throw new Error("Cannot search with empty vector");
    }
    for (const v of vector) {
      if (!Number.isFinite(v)) {
        throw new Error(`Invalid vector value: ${v}`);
      }
    }
    if (limit <= 0) {
      return [];
    }
    const rows = this.db.prepare("SELECT id, vector FROM vectors").all();
    if (rows.length === 0) {
      return [];
    }
    const firstStoredDim = rows[0].vector.byteLength / 4;
    if (vector.length !== firstStoredDim) {
      throw new Error(
        `Dimension mismatch: query has ${vector.length} dimensions, stored vectors have ${firstStoredDim}`
      );
    }
    const queryVec = new Float32Array(vector);
    const results = [];
    for (const row of rows) {
      const storedVec = new Float32Array(
        row.vector.buffer,
        row.vector.byteOffset,
        row.vector.byteLength / 4
      );
      const distance = cosineDistance(queryVec, storedVec);
      results.push({ id: row.id, distance });
    }
    results.sort((a, b) => a.distance - b.distance);
    return results.slice(0, limit);
  }
  async delete(id) {
    this.db.prepare("DELETE FROM vectors WHERE id = ?").run(id);
  }
  async getModel(id) {
    const row = this.db.prepare("SELECT model FROM vectors WHERE id = ?").get(id);
    return row?.model ?? null;
  }
  hasEmbedding(id) {
    const row = this.db.prepare("SELECT 1 FROM vectors WHERE id = ?").get(id);
    return row !== void 0;
  }
  /** For testing: get table names */
  getTableNames() {
    const rows = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    return rows.map((r) => r.name);
  }
  /** For testing: get vector blob size */
  getVectorBlobSize(id) {
    const row = this.db.prepare("SELECT LENGTH(vector) as size FROM vectors WHERE id = ?").get(id);
    return row?.size ?? null;
  }
  /** Get total number of stored embeddings */
  getEmbeddingCount() {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM vectors").get();
    return row.count;
  }
  close() {
    if (this.ownsDb) {
      this.db.close();
    }
  }
};

// src/providers/docstore/parser.ts
import matter from "gray-matter";
function parseMarkdown(raw) {
  let parsed;
  try {
    parsed = matter(raw);
  } catch {
    return {
      title: void 0,
      tags: [],
      properties: {},
      content: raw
    };
  }
  const data = parsed.data;
  const title = typeof data["title"] === "string" ? data["title"] : void 0;
  let tags = [];
  if (Array.isArray(data["tags"])) {
    tags = data["tags"].filter((t) => typeof t === "string");
  }
  const properties = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== "title" && key !== "tags") {
      properties[key] = value;
    }
  }
  return {
    title,
    tags,
    properties,
    content: parsed.content.trim()
  };
}
function extractWikiLinks(content) {
  const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, "");
  const withoutInlineCode = withoutCodeBlocks.replace(/`[^`]+`/g, "");
  const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const seen = /* @__PURE__ */ new Set();
  const links = [];
  let match;
  while ((match = linkRegex.exec(withoutInlineCode)) !== null) {
    const target = match[1]?.trim();
    if (target && !seen.has(target)) {
      seen.add(target);
      links.push(target);
    }
  }
  return links;
}
function normalizeId(path) {
  return path.toLowerCase().replace(/\\/g, "/");
}
function titleFromPath(path) {
  const parts = path.split(/[/\\]/);
  const filename = parts.at(-1);
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  const spaced = withoutExt.replace(/[-_]+/g, " ").toLowerCase();
  return spaced.split(" ").filter((w) => w.length > 0).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
function serializeToMarkdown(parsed) {
  const hasFrontmatter = parsed.title !== void 0 || parsed.tags.length > 0 || Object.keys(parsed.properties).length > 0;
  if (!hasFrontmatter) {
    return parsed.content;
  }
  const frontmatter = {};
  if (parsed.title !== void 0) {
    frontmatter["title"] = parsed.title;
  }
  if (parsed.tags.length > 0) {
    frontmatter["tags"] = parsed.tags;
  }
  for (const [key, value] of Object.entries(parsed.properties)) {
    frontmatter[key] = value;
  }
  return matter.stringify(parsed.content, frontmatter);
}

// src/providers/docstore/watcher.ts
import { watch } from "chokidar";
import { relative, extname } from "path";
var EXCLUDED_DIRS = /* @__PURE__ */ new Set([
  ".roux",
  "node_modules",
  ".git",
  ".obsidian"
]);
var DEFAULT_DEBOUNCE_MS = 1e3;
var FileWatcher = class {
  root;
  extensions;
  debounceMs;
  onBatch;
  watcher = null;
  debounceTimer = null;
  pendingChanges = /* @__PURE__ */ new Map();
  constructor(options) {
    this.root = options.root;
    this.extensions = options.extensions;
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.onBatch = options.onBatch;
  }
  start() {
    if (this.watcher) {
      return Promise.reject(new Error("Already watching. Call stop() first."));
    }
    return new Promise((resolve2, reject) => {
      let isReady = false;
      this.watcher = watch(this.root, {
        ignoreInitial: true,
        ignored: [...EXCLUDED_DIRS].map((dir) => `**/${dir}/**`),
        awaitWriteFinish: {
          stabilityThreshold: 100
        },
        followSymlinks: false
      });
      this.watcher.on("ready", () => {
        isReady = true;
        resolve2();
      }).on("add", (path) => this.queueChange(path, "add")).on("change", (path) => this.queueChange(path, "change")).on("unlink", (path) => this.queueChange(path, "unlink")).on("error", (err) => {
        if (err.code === "EMFILE") {
          console.error(
            "File watcher hit file descriptor limit. Try: ulimit -n 65536 or reduce watched files."
          );
        }
        if (isReady) {
          console.error("FileWatcher error:", err);
        } else {
          reject(err);
        }
      });
    });
  }
  stop() {
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
  isWatching() {
    return this.watcher !== null;
  }
  flush() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.pendingChanges.size === 0) {
      return;
    }
    const batch = new Map(this.pendingChanges);
    this.pendingChanges.clear();
    try {
      const result = this.onBatch(batch);
      if (result && typeof result.catch === "function") {
        result.catch((err) => {
          console.error("FileWatcher onBatch callback threw an error:", err);
        });
      }
    } catch (err) {
      console.error("FileWatcher onBatch callback threw an error:", err);
    }
  }
  queueChange(filePath, event) {
    const relativePath = relative(this.root, filePath);
    const ext = extname(filePath).toLowerCase();
    if (!ext || !this.extensions.has(ext)) {
      return;
    }
    const pathParts = relativePath.split("/");
    for (const part of pathParts) {
      if (EXCLUDED_DIRS.has(part)) {
        return;
      }
    }
    const id = relativePath.toLowerCase().replace(/\\/g, "/");
    const existing = this.pendingChanges.get(id);
    if (existing) {
      if (existing === "add" && event === "change") {
        return;
      } else if (existing === "add" && event === "unlink") {
        this.pendingChanges.delete(id);
      } else if (existing === "change" && event === "unlink") {
        this.pendingChanges.set(id, "unlink");
      } else if (existing === "change" && event === "add") {
        this.pendingChanges.set(id, "add");
      } else if (existing === "unlink" && event === "add") {
        this.pendingChanges.set(id, "add");
      } else if (existing === "unlink" && event === "change") {
        return;
      }
    } else {
      this.pendingChanges.set(id, event);
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.flush();
    }, this.debounceMs);
  }
};

// src/providers/docstore/links.ts
function hasFileExtension(path) {
  const match = path.match(/\.([a-z0-9]{1,4})$/i);
  if (!match?.[1]) return false;
  return /[a-z]/i.test(match[1]);
}
function normalizeWikiLink(target) {
  let normalized = target.toLowerCase().replace(/\\/g, "/");
  if (!hasFileExtension(normalized)) {
    normalized += ".md";
  }
  return normalized;
}
function buildFilenameIndex(nodes) {
  const index = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    const basename = node.id.split("/").pop();
    const existing = index.get(basename) ?? [];
    existing.push(node.id);
    index.set(basename, existing);
  }
  for (const paths of index.values()) {
    paths.sort();
  }
  return index;
}
function resolveLinks(outgoingLinks, filenameIndex, validNodeIds) {
  return outgoingLinks.map((link) => {
    if (validNodeIds.has(link)) {
      return link;
    }
    if (link.includes("/")) {
      return link;
    }
    const matches = filenameIndex.get(link);
    if (matches && matches.length > 0) {
      return matches[0];
    }
    return link;
  });
}

// src/providers/docstore/file-operations.ts
import { readFile, stat, readdir } from "fs/promises";
import { join as join3, resolve, extname as extname2 } from "path";
async function getFileMtime(filePath) {
  const stats = await stat(filePath);
  return stats.mtimeMs;
}
function validatePathWithinSource(sourceRoot, id) {
  const resolvedPath = resolve(sourceRoot, id);
  const resolvedRoot = resolve(sourceRoot);
  if (!resolvedPath.startsWith(resolvedRoot + "/")) {
    throw new Error(`Path traversal detected: ${id} resolves outside source root`);
  }
}
async function collectFiles(dir, extensions) {
  if (extensions.size === 0) {
    return [];
  }
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = join3(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }
      const nested = await collectFiles(fullPath, extensions);
      results.push(...nested);
    } else if (entry.isFile()) {
      const ext = extname2(entry.name).toLowerCase();
      if (ext && extensions.has(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}
async function readFileContent(filePath) {
  return readFile(filePath, "utf-8");
}

// src/providers/docstore/reader-registry.ts
var ReaderRegistry = class {
  readers = /* @__PURE__ */ new Map();
  /**
   * Register a reader for its declared extensions.
   * Throws if any extension is already registered (atomic - no partial registration).
   */
  register(reader) {
    for (const ext of reader.extensions) {
      const normalizedExt = ext.toLowerCase();
      if (this.readers.has(normalizedExt)) {
        throw new Error(`Extension already registered: ${ext}`);
      }
    }
    for (const ext of reader.extensions) {
      const normalizedExt = ext.toLowerCase();
      this.readers.set(normalizedExt, reader);
    }
  }
  /**
   * Get reader for an extension, or null if none registered.
   * Case-insensitive.
   */
  getReader(extension) {
    return this.readers.get(extension.toLowerCase()) ?? null;
  }
  /**
   * Get all registered extensions
   */
  getExtensions() {
    return new Set(this.readers.keys());
  }
  /**
   * Check if an extension has a registered reader.
   * Case-insensitive.
   */
  hasReader(extension) {
    return this.readers.has(extension.toLowerCase());
  }
  /**
   * Parse content using the appropriate reader for the file's extension.
   * Throws if no reader is registered for the extension.
   */
  parse(content, context) {
    const reader = this.getReader(context.extension);
    if (!reader) {
      throw new Error(`No reader registered for extension: ${context.extension}`);
    }
    return reader.parse(content, context);
  }
};

// src/providers/docstore/readers/markdown.ts
var MarkdownReader = class {
  extensions = [".md", ".markdown"];
  parse(content, context) {
    const parsed = parseMarkdown(content);
    const id = normalizeId(context.relativePath);
    const title = parsed.title ?? titleFromPath(id);
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
        type: "file",
        path: context.absolutePath,
        lastModified: context.mtime
      }
    };
  }
};

// src/providers/docstore/index.ts
function createDefaultRegistry() {
  const registry = new ReaderRegistry();
  registry.register(new MarkdownReader());
  return registry;
}
var DocStore = class extends StoreProvider {
  cache;
  sourceRoot;
  ownsVectorIndex;
  registry;
  fileWatcher = null;
  onChangeCallback;
  constructor(sourceRoot, cacheDir, vectorIndex, registry) {
    const ownsVector = !vectorIndex;
    if (!vectorIndex) mkdirSync2(cacheDir, { recursive: true });
    const vi = vectorIndex ?? new SqliteVectorIndex(cacheDir);
    super({ vectorIndex: vi });
    this.sourceRoot = sourceRoot;
    this.cache = new Cache(cacheDir);
    this.ownsVectorIndex = ownsVector;
    this.registry = registry ?? createDefaultRegistry();
  }
  async sync() {
    const extensions = this.registry.getExtensions();
    const currentPaths = await collectFiles(this.sourceRoot, extensions);
    const trackedPaths = this.cache.getAllTrackedPaths();
    for (const filePath of currentPaths) {
      try {
        const mtime = await getFileMtime(filePath);
        const cachedMtime = this.cache.getModifiedTime(filePath);
        if (cachedMtime === null || mtime > cachedMtime) {
          const node = await this.parseFile(filePath);
          this.cache.upsertNode(node, "file", filePath, mtime);
        }
      } catch (err) {
        if (err.code === "ENOENT") {
          continue;
        }
        console.warn(`Failed to process file ${filePath}:`, err);
        continue;
      }
    }
    const currentSet = new Set(currentPaths);
    for (const tracked of trackedPaths) {
      if (!currentSet.has(tracked)) {
        const node = this.cache.getNodeByPath(tracked);
        if (node) {
          this.cache.deleteNode(node.id);
        }
      }
    }
    this.resolveAllLinks();
    await this.syncGraph();
  }
  async createNode(node) {
    const normalizedId = normalizeId(node.id);
    validatePathWithinSource(this.sourceRoot, normalizedId);
    const existing = this.cache.getNode(normalizedId);
    if (existing) {
      throw new Error(`Node already exists: ${normalizedId}`);
    }
    const filePath = join4(this.sourceRoot, normalizedId);
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });
    const parsed = {
      title: node.title,
      tags: node.tags,
      properties: node.properties,
      content: node.content
    };
    const markdown = serializeToMarkdown(parsed);
    await writeFile(filePath, markdown, "utf-8");
    let outgoingLinks = node.outgoingLinks;
    if (node.content && (!outgoingLinks || outgoingLinks.length === 0)) {
      const rawLinks = extractWikiLinks(node.content);
      outgoingLinks = rawLinks.map((link) => normalizeWikiLink(link));
    }
    const mtime = await getFileMtime(filePath);
    const normalizedNode = { ...node, id: normalizedId, outgoingLinks: outgoingLinks ?? [] };
    this.cache.upsertNode(normalizedNode, "file", filePath, mtime);
    this.resolveAllLinks();
    await this.syncGraph();
  }
  async updateNode(id, updates) {
    const normalizedId = normalizeId(id);
    const existing = this.cache.getNode(normalizedId);
    if (!existing) {
      throw new Error(`Node not found: ${id}`);
    }
    let outgoingLinks = updates.outgoingLinks;
    if (updates.content !== void 0 && outgoingLinks === void 0) {
      const rawLinks = extractWikiLinks(updates.content);
      outgoingLinks = rawLinks.map((link) => normalizeWikiLink(link));
    }
    const updated = {
      ...existing,
      ...updates,
      outgoingLinks: outgoingLinks ?? existing.outgoingLinks,
      id: existing.id
      // ID cannot be changed
    };
    const filePath = join4(this.sourceRoot, existing.id);
    const parsed = {
      title: updated.title,
      tags: updated.tags,
      properties: updated.properties,
      content: updated.content
    };
    const markdown = serializeToMarkdown(parsed);
    await writeFile(filePath, markdown, "utf-8");
    const mtime = await getFileMtime(filePath);
    this.cache.upsertNode(updated, "file", filePath, mtime);
    if (outgoingLinks !== void 0 || updates.outgoingLinks !== void 0) {
      this.resolveAllLinks();
      await this.syncGraph();
    }
  }
  async deleteNode(id) {
    const normalizedId = normalizeId(id);
    const existing = this.cache.getNode(normalizedId);
    if (!existing) {
      throw new Error(`Node not found: ${id}`);
    }
    const filePath = join4(this.sourceRoot, existing.id);
    await rm(filePath);
    this.cache.deleteNode(existing.id);
    if (this.vectorIndex) await this.vectorIndex.delete(existing.id);
    await this.syncGraph();
  }
  async getNode(id) {
    const normalizedId = normalizeId(id);
    return this.cache.getNode(normalizedId);
  }
  async getNodes(ids) {
    const normalizedIds = ids.map(normalizeId);
    return this.cache.getNodes(normalizedIds);
  }
  async getAllNodeIds() {
    const nodes = this.cache.getAllNodes();
    return nodes.map((n) => n.id);
  }
  async searchByTags(tags, mode, limit) {
    return this.cache.searchByTags(tags, mode, limit);
  }
  async resolveTitles(ids) {
    return this.cache.resolveTitles(ids);
  }
  async listNodes(filter, options) {
    return this.cache.listNodes(filter, options);
  }
  async resolveNodes(names, options) {
    const strategy = options?.strategy ?? "fuzzy";
    if (strategy === "exact" || strategy === "fuzzy") {
      return this.cache.resolveNodes(names, options);
    }
    return names.map((query) => ({ query, match: null, score: 0 }));
  }
  async nodesExist(ids) {
    const normalizedIds = ids.map(normalizeId);
    return this.cache.nodesExist(normalizedIds);
  }
  hasEmbedding(id) {
    if (!this.vectorIndex) return false;
    return this.vectorIndex.hasEmbedding(id);
  }
  close() {
    this.stopWatching();
    this.cache.close();
    if (this.ownsVectorIndex && this.vectorIndex && "close" in this.vectorIndex) {
      this.vectorIndex.close();
    }
  }
  startWatching(onChange) {
    if (this.fileWatcher?.isWatching()) {
      throw new Error("Already watching. Call stopWatching() first.");
    }
    this.onChangeCallback = onChange;
    if (!this.fileWatcher) {
      this.fileWatcher = new FileWatcher({
        root: this.sourceRoot,
        extensions: this.registry.getExtensions(),
        onBatch: (events) => this.handleWatcherBatch(events)
      });
    }
    return this.fileWatcher.start();
  }
  stopWatching() {
    if (this.fileWatcher) {
      this.fileWatcher.stop();
    }
  }
  isWatching() {
    return this.fileWatcher?.isWatching() ?? false;
  }
  async handleWatcherBatch(events) {
    const processedIds = [];
    for (const [id, event] of events) {
      try {
        if (event === "unlink") {
          const existing = this.cache.getNode(id);
          if (existing) {
            this.cache.deleteNode(id);
            if (this.vectorIndex) await this.vectorIndex.delete(id);
            processedIds.push(id);
          }
        } else {
          const filePath = join4(this.sourceRoot, id);
          const node = await this.parseFile(filePath);
          const mtime = await getFileMtime(filePath);
          this.cache.upsertNode(node, "file", filePath, mtime);
          processedIds.push(id);
        }
      } catch (err) {
        console.warn(`Failed to process file change for ${id}:`, err);
      }
    }
    if (processedIds.length > 0) {
      this.resolveAllLinks();
      await this.syncGraph();
    }
    if (this.onChangeCallback && processedIds.length > 0) {
      this.onChangeCallback(processedIds);
    }
  }
  resolveAllLinks() {
    const nodes = this.cache.getAllNodes();
    const filenameIndex = buildFilenameIndex(nodes);
    const validNodeIds = /* @__PURE__ */ new Set();
    for (const paths of filenameIndex.values()) {
      for (const path of paths) {
        validNodeIds.add(path);
      }
    }
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
  async loadAllNodes() {
    return this.cache.getAllNodes();
  }
  async getNodesByIds(ids) {
    return this.cache.getNodes(ids);
  }
  onCentralityComputed(centrality) {
    const now = Date.now();
    for (const [id, metrics] of centrality) {
      this.cache.storeCentrality(id, 0, metrics.inDegree, metrics.outDegree, now);
    }
  }
  /**
   * Parse a file into a Node using the appropriate FormatReader.
   */
  async parseFile(filePath) {
    const content = await readFileContent(filePath);
    const relativePath = relative2(this.sourceRoot, filePath);
    const ext = extname3(filePath).toLowerCase();
    const mtime = new Date(await getFileMtime(filePath));
    const context = {
      absolutePath: filePath,
      relativePath,
      extension: ext,
      mtime
    };
    return this.registry.parse(content, context);
  }
};

// src/providers/embedding/transformers.ts
import { pipeline } from "@xenova/transformers";
var DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";
var DEFAULT_DIMENSIONS = 384;
var TransformersEmbedding = class {
  model;
  dims;
  pipe = null;
  constructor(model = DEFAULT_MODEL, dimensions = DEFAULT_DIMENSIONS) {
    this.model = model;
    this.dims = dimensions;
  }
  async getPipeline() {
    if (!this.pipe) {
      this.pipe = await pipeline("feature-extraction", this.model);
    }
    return this.pipe;
  }
  async embed(text) {
    const pipe = await this.getPipeline();
    const output = await pipe(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  }
  async embedBatch(texts) {
    if (texts.length === 0) {
      return [];
    }
    return Promise.all(texts.map((t) => this.embed(t)));
  }
  dimensions() {
    return this.dims;
  }
  modelId() {
    return this.model;
  }
};

// src/core/graphcore.ts
var GraphCoreImpl = class _GraphCoreImpl {
  store = null;
  embedding = null;
  registerStore(provider) {
    if (!provider) {
      throw new Error("Store provider is required");
    }
    this.store = provider;
  }
  registerEmbedding(provider) {
    if (!provider) {
      throw new Error("Embedding provider is required");
    }
    this.embedding = provider;
  }
  requireStore() {
    if (!this.store) {
      throw new Error("Store not registered");
    }
    return this.store;
  }
  requireEmbedding() {
    if (!this.embedding) {
      throw new Error("Embedding not registered");
    }
    return this.embedding;
  }
  async search(query, options) {
    const store = this.requireStore();
    const embedding = this.requireEmbedding();
    const limit = options?.limit ?? 10;
    const vector = await embedding.embed(query);
    const results = await store.searchByVector(vector, limit);
    const ids = results.map((r) => r.id);
    return store.getNodes(ids);
  }
  async getNode(id, depth) {
    const store = this.requireStore();
    const node = await store.getNode(id);
    if (!node) {
      return null;
    }
    if (!depth || depth === 0) {
      return node;
    }
    const [incomingNeighbors, outgoingNeighbors] = await Promise.all([
      store.getNeighbors(id, { direction: "in" }),
      store.getNeighbors(id, { direction: "out" })
    ]);
    const neighborMap = /* @__PURE__ */ new Map();
    for (const n of [...incomingNeighbors, ...outgoingNeighbors]) {
      neighborMap.set(n.id, n);
    }
    const result = {
      ...node,
      neighbors: Array.from(neighborMap.values()),
      incomingCount: incomingNeighbors.length,
      outgoingCount: outgoingNeighbors.length
    };
    return result;
  }
  async createNode(partial) {
    const store = this.requireStore();
    if (!partial.id || partial.id.trim() === "") {
      throw new Error("Node id is required and cannot be empty");
    }
    if (!partial.title) {
      throw new Error("Node title is required");
    }
    const node = {
      id: partial.id,
      title: partial.title,
      content: partial.content ?? "",
      tags: partial.tags ?? [],
      outgoingLinks: partial.outgoingLinks ?? [],
      properties: partial.properties ?? {},
      ...partial.sourceRef && { sourceRef: partial.sourceRef }
    };
    await store.createNode(node);
    return await store.getNode(node.id) ?? node;
  }
  async updateNode(id, updates) {
    const store = this.requireStore();
    await store.updateNode(id, updates);
    const updated = await store.getNode(id);
    if (!updated) {
      throw new Error(`Node not found after update: ${id}`);
    }
    return updated;
  }
  async deleteNode(id) {
    const store = this.requireStore();
    try {
      await store.deleteNode(id);
      return true;
    } catch (err) {
      if (err instanceof Error && /not found/i.test(err.message)) {
        return false;
      }
      throw err;
    }
  }
  async getNeighbors(id, options) {
    const store = this.requireStore();
    return store.getNeighbors(id, options);
  }
  async findPath(source, target) {
    const store = this.requireStore();
    return store.findPath(source, target);
  }
  async getHubs(metric, limit) {
    const store = this.requireStore();
    return store.getHubs(metric, limit);
  }
  async searchByTags(tags, mode, limit) {
    const store = this.requireStore();
    return store.searchByTags(tags, mode, limit);
  }
  async getRandomNode(tags) {
    const store = this.requireStore();
    return store.getRandomNode(tags);
  }
  async listNodes(filter, options) {
    return this.requireStore().listNodes(filter, options);
  }
  async resolveNodes(names, options) {
    const store = this.requireStore();
    const strategy = options?.strategy ?? "fuzzy";
    if (strategy === "semantic") {
      if (!this.embedding) {
        throw new Error("Semantic resolution requires Embedding");
      }
      const filter = {};
      if (options?.tag) filter.tag = options.tag;
      if (options?.path) filter.path = options.path;
      const { nodes: candidates } = await store.listNodes(filter, { limit: 1e3 });
      if (candidates.length === 0 || names.length === 0) {
        return names.map((query) => ({ query, match: null, score: 0 }));
      }
      const threshold = options?.threshold ?? 0.7;
      const queryVectors = await this.embedding.embedBatch(names);
      const candidateTitles = candidates.map((c) => c.title);
      const candidateVectors = await this.embedding.embedBatch(candidateTitles);
      if (queryVectors.length > 0 && candidateVectors.length > 0) {
        const queryDim = queryVectors[0].length;
        const candidateDim = candidateVectors[0].length;
        if (queryDim !== candidateDim) {
          throw new Error(
            `Embedding dimension mismatch: query=${queryDim}, candidate=${candidateDim}`
          );
        }
      }
      return names.map((query, qIdx) => {
        const queryVector = queryVectors[qIdx];
        let bestScore = 0;
        let bestMatch = null;
        for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
          const similarity = cosineSimilarity(queryVector, candidateVectors[cIdx]);
          if (similarity > bestScore) {
            bestScore = similarity;
            bestMatch = candidates[cIdx].id;
          }
        }
        if (bestScore >= threshold) {
          return { query, match: bestMatch, score: bestScore };
        }
        return { query, match: null, score: 0 };
      });
    }
    return store.resolveNodes(names, options);
  }
  static fromConfig(config) {
    if (!config.providers?.store) {
      throw new Error("Store configuration is required");
    }
    const core = new _GraphCoreImpl();
    if (config.providers.store.type === "docstore") {
      const sourcePath = config.source?.path ?? ".";
      const cachePath = config.cache?.path ?? ".roux";
      const store = new DocStore(sourcePath, cachePath);
      core.registerStore(store);
    } else {
      throw new Error(
        `Unsupported store provider type: ${config.providers.store.type}. Supported: docstore`
      );
    }
    const embeddingConfig = config.providers.embedding;
    if (!embeddingConfig || embeddingConfig.type === "local") {
      const model = embeddingConfig?.model;
      const embedding = new TransformersEmbedding(model);
      core.registerEmbedding(embedding);
    } else {
      throw new Error(
        `Unsupported embedding provider type: ${embeddingConfig.type}. Supported: local`
      );
    }
    return core;
  }
};

// src/index.ts
var VERSION = "0.1.3";
export {
  DEFAULT_CONFIG,
  DocStore,
  GraphCoreImpl,
  SqliteVectorIndex,
  StoreProvider,
  TransformersEmbedding,
  VERSION,
  isNode,
  isSourceRef,
  isVectorIndex
};
//# sourceMappingURL=index.js.map