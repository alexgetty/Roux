#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
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

// src/cli/index.ts
import { Command } from "commander";
import { resolve as resolve2 } from "path";
import { execFile } from "child_process";

// src/cli/commands/init.ts
import { mkdir, writeFile, readFile, access } from "fs/promises";
import { join } from "path";
var DEFAULT_CONFIG = `providers:
  store:
    type: docstore
`;
var ROUX_MCP_CONFIG = {
  command: "npx",
  args: ["roux", "serve", "."],
  env: {}
};
var HOOK_MARKER = "roux-enforce-mcp";
var ENFORCE_MCP_HOOK_COMMAND = `node -e "/* ${HOOK_MARKER} */ const d=JSON.parse(require('fs').readFileSync(0,'utf8'));const p=d.tool_input?.file_path||'';if(p.endsWith('.md')){console.error('Use mcp__roux__* tools for markdown files instead of Read/Edit/Write');process.exit(2)}"`;
var ROUX_HOOK_ENTRY = {
  matcher: "Read|Edit|Write",
  hooks: [{ type: "command", command: ENFORCE_MCP_HOOK_COMMAND }]
};
async function initCommand(directory) {
  const configPath = join(directory, "roux.yaml");
  const rouxDir = join(directory, ".roux");
  let configExists = false;
  try {
    await access(configPath);
    configExists = true;
  } catch {
  }
  await mkdir(rouxDir, { recursive: true });
  await updateMcpConfig(directory);
  const storeType = await getStoreType(directory, configExists);
  let hooksInstalled = false;
  if (storeType === "docstore") {
    hooksInstalled = await updateClaudeSettings(directory);
  }
  if (configExists) {
    return { created: false, configPath, hooksInstalled };
  }
  await writeFile(configPath, DEFAULT_CONFIG, "utf-8");
  return { created: true, configPath, hooksInstalled };
}
async function updateMcpConfig(directory) {
  const mcpPath = join(directory, ".mcp.json");
  let config = {};
  try {
    const content = await readFile(mcpPath, "utf-8");
    config = JSON.parse(content);
  } catch {
  }
  if (!config.mcpServers) {
    config.mcpServers = {};
  }
  config.mcpServers.roux = ROUX_MCP_CONFIG;
  await writeFile(mcpPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
async function getStoreType(directory, configExists) {
  if (!configExists) {
    return "docstore";
  }
  try {
    const configPath = join(directory, "roux.yaml");
    const content = await readFile(configPath, "utf-8");
    const typeMatch = content.match(/store:\s*\n\s*type:\s*(\w+)/);
    if (typeMatch?.[1]) {
      return typeMatch[1];
    }
  } catch {
  }
  return "docstore";
}
async function updateClaudeSettings(directory) {
  const claudeDir = join(directory, ".claude");
  const settingsPath = join(claudeDir, "settings.json");
  await mkdir(claudeDir, { recursive: true });
  let config = {};
  let existingContent = null;
  try {
    existingContent = await readFile(settingsPath, "utf-8");
    config = JSON.parse(existingContent);
  } catch (err) {
    if (existingContent !== null) {
      return false;
    }
  }
  if (!config.hooks) {
    config.hooks = {};
  }
  if (!config.hooks.PreToolUse) {
    config.hooks.PreToolUse = [];
  }
  const hasRouxHook = config.hooks.PreToolUse.some(
    (entry) => entry.hooks?.some((h) => h.command?.includes(HOOK_MARKER))
  );
  if (hasRouxHook) {
    return false;
  }
  config.hooks.PreToolUse.push(ROUX_HOOK_ENTRY);
  await writeFile(settingsPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  return true;
}

// src/cli/commands/status.ts
import { access as access2 } from "fs/promises";
import { join as join4 } from "path";

// src/providers/docstore/cache.ts
import Database from "better-sqlite3";
import { join as join2 } from "path";
import { mkdirSync } from "fs";

// src/providers/docstore/cache/centrality.ts
function initCentralitySchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS centrality (
      node_id TEXT PRIMARY KEY,
      pagerank REAL,
      in_degree INTEGER,
      out_degree INTEGER,
      computed_at INTEGER,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
    )
  `);
}
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

// src/providers/docstore/cache.ts
var Cache = class {
  db;
  constructor(cacheDir) {
    mkdirSync(cacheDir, { recursive: true });
    const dbPath = join2(cacheDir, "cache.db");
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

      CREATE INDEX IF NOT EXISTS idx_nodes_source_path ON nodes(source_path);
    `);
    initCentralitySchema(this.db);
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
    const row = this.db.prepare("SELECT * FROM nodes WHERE LOWER(source_path) = LOWER(?)").get(sourcePath);
    if (!row) return null;
    return this.rowToNode(row);
  }
  getAllTrackedPaths() {
    const rows = this.db.prepare("SELECT source_path FROM nodes").all();
    return new Set(rows.map((r) => r.source_path));
  }
  updateSourcePath(id, newPath) {
    this.db.prepare("UPDATE nodes SET source_path = ? WHERE id = ?").run(newPath, id);
  }
  getIdByPath(sourcePath) {
    const row = this.db.prepare("SELECT id FROM nodes WHERE source_path = ?").get(sourcePath);
    return row?.id ?? null;
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
      conditions.push("LOWER(source_path) LIKE '%' || LOWER(?) || '%'");
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
  storeCentrality(nodeId, pagerank, inDegree, outDegree, computedAt) {
    storeCentrality(this.db, nodeId, pagerank, inDegree, outDegree, computedAt);
  }
  getCentrality(nodeId) {
    return getCentrality(this.db, nodeId);
  }
  getStats() {
    const nodeCount = this.db.prepare("SELECT COUNT(*) as count FROM nodes").get();
    const edgeSum = this.db.prepare("SELECT SUM(in_degree) as total FROM centrality").get();
    return {
      nodeCount: nodeCount.count,
      edgeCount: edgeSum.total ?? 0
    };
  }
  clear() {
    this.db.exec("DELETE FROM centrality");
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
import { join as join3 } from "path";

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

// src/utils/math.ts
function cosineSimilarity(a, b) {
  if (a.length === 0 || b.length === 0) {
    throw new Error("Cannot compute similarity for empty vector");
  }
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }
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
  modelMismatchWarned = false;
  constructor(pathOrDb) {
    if (typeof pathOrDb === "string") {
      this.db = new Database2(join3(pathOrDb, "vectors.db"));
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
    if (!this.modelMismatchWarned) {
      const models = this.db.prepare("SELECT DISTINCT model FROM vectors").all();
      if (models.length > 1) {
        console.warn(
          `Vector index contains embeddings from multiple models: ${models.map((m) => m.model).join(", ")}. Search results may be unreliable. Re-sync to re-embed all documents with current model.`
        );
        this.modelMismatchWarned = true;
      }
    }
    const queryVec = new Float32Array(vector);
    const stmt = this.db.prepare("SELECT id, vector FROM vectors");
    const heap = new MinHeap(
      (a, b) => b.distance - a.distance
    );
    let dimensionChecked = false;
    for (const row of stmt.iterate()) {
      if (!dimensionChecked) {
        const storedDim = row.vector.byteLength / 4;
        if (vector.length !== storedDim) {
          throw new Error(
            `Dimension mismatch: query has ${vector.length} dimensions, stored vectors have ${storedDim}`
          );
        }
        dimensionChecked = true;
      }
      const storedVec = new Float32Array(
        row.vector.buffer,
        row.vector.byteOffset,
        row.vector.byteLength / 4
      );
      const distance = cosineDistance(queryVec, storedVec);
      if (heap.size() < limit) {
        heap.push({ id: row.id, distance });
      } else if (distance < heap.peek().distance) {
        heap.pop();
        heap.push({ id: row.id, distance });
      }
    }
    return heap.toArray().sort((a, b) => a.distance - b.distance);
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

// src/cli/commands/status.ts
async function statusCommand(directory) {
  const configPath = join4(directory, "roux.yaml");
  try {
    await access2(configPath);
  } catch {
    throw new Error(`Directory not initialized. Run 'roux init' first.`);
  }
  const cacheDir = join4(directory, ".roux");
  const cache = new Cache(cacheDir);
  const vectorProvider = new SqliteVectorIndex(cacheDir);
  try {
    const stats = cache.getStats();
    const embeddingCount = vectorProvider.getEmbeddingCount();
    const embeddingCoverage = stats.nodeCount === 0 ? 1 : embeddingCount / stats.nodeCount;
    return {
      nodeCount: stats.nodeCount,
      edgeCount: stats.edgeCount,
      embeddingCount,
      embeddingCoverage
    };
  } finally {
    cache.close();
    vectorProvider.close();
  }
}

// src/cli/commands/serve.ts
import { access as access3, readFile as readFile3 } from "fs/promises";
import { join as join7 } from "path";
import { parse as parseYaml } from "yaml";

// src/providers/docstore/index.ts
import { writeFile as writeFile2, mkdir as mkdir2, rm, stat as stat2 } from "fs/promises";
import { mkdirSync as mkdirSync2 } from "fs";
import { join as join6, relative as relative2, dirname, extname as extname3 } from "path";

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
function getNeighborIds(graph, id, options) {
  if (!graph.hasNode(id)) {
    return [];
  }
  const limit = options.limit;
  if (limit !== void 0 && limit <= 0) {
    return [];
  }
  const maxCount = limit ?? Infinity;
  const direction = options.direction;
  if (direction === "both") {
    const neighbors2 = [];
    for (const entry of graph.neighborEntries(id)) {
      if (neighbors2.length >= maxCount) break;
      neighbors2.push(entry.neighbor);
    }
    return neighbors2;
  }
  const neighbors = [];
  const iterator = direction === "in" ? graph.inNeighborEntries(id) : graph.outNeighborEntries(id);
  for (const entry of iterator) {
    if (neighbors.length >= maxCount) break;
    neighbors.push(entry.neighbor);
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
  return heap.toArray().sort((a, b) => {
    const scoreDiff = b[1] - a[1];
    if (scoreDiff !== 0) return scoreDiff;
    return a[0].localeCompare(b[0]);
  });
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
      const lowerPath = filter.path.toLowerCase();
      nodes = nodes.filter((n) => n.id.startsWith(lowerPath));
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
      const lowerPath = options.path.toLowerCase();
      candidates = candidates.filter((c) => c.id.startsWith(lowerPath));
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

// src/providers/docstore/parser.ts
import matter from "gray-matter";

// src/providers/docstore/normalize.ts
function hasFileExtension(path) {
  const match = path.match(/\.([a-z0-9]{1,4})$/i);
  if (!match?.[1]) return false;
  return /[a-z]/i.test(match[1]);
}
function normalizePath(path) {
  return path.toLowerCase().replace(/\\/g, "/");
}
function normalizeLinkTarget(target) {
  let normalized = target.trim().toLowerCase().replace(/\\/g, "/");
  if (!hasFileExtension(normalized)) {
    normalized += ".md";
  }
  return normalized;
}

// src/providers/docstore/parser.ts
var RESERVED_FRONTMATTER_KEYS = ["id", "title", "tags"];
var RESERVED_KEYS_SET = new Set(RESERVED_FRONTMATTER_KEYS);
function parseMarkdown(raw) {
  let parsed;
  try {
    parsed = matter(raw);
  } catch {
    return {
      title: void 0,
      tags: [],
      properties: {},
      content: raw,
      rawLinks: extractWikiLinks(raw)
    };
  }
  const data = parsed.data;
  const id = typeof data["id"] === "string" ? data["id"] : void 0;
  const title = typeof data["title"] === "string" ? data["title"] : void 0;
  let tags = [];
  if (Array.isArray(data["tags"])) {
    tags = data["tags"].filter((t) => typeof t === "string");
  }
  const properties = {};
  for (const [key, value] of Object.entries(data)) {
    if (!RESERVED_KEYS_SET.has(key)) {
      properties[key] = value;
    }
  }
  const content = parsed.content.trim();
  const result = {
    title,
    tags,
    properties,
    content,
    rawLinks: extractWikiLinks(content)
  };
  if (id !== void 0) {
    result.id = id;
  }
  return result;
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
var normalizeId = normalizePath;
function titleFromPath(path) {
  const parts = path.split(/[/\\]/);
  const filename = parts.at(-1);
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  const spaced = withoutExt.replace(/[-_]+/g, " ").toLowerCase();
  return spaced.split(" ").filter((w) => w.length > 0).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
function serializeToMarkdown(parsed) {
  const hasFrontmatter = parsed.id !== void 0 || parsed.title !== void 0 || parsed.tags.length > 0 || Object.keys(parsed.properties).length > 0;
  if (!hasFrontmatter) {
    return parsed.content;
  }
  const frontmatter = {};
  if (parsed.id !== void 0) {
    frontmatter["id"] = parsed.id;
  }
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

// src/providers/docstore/constants.ts
var EXCLUDED_DIRS = /* @__PURE__ */ new Set([
  ".roux",
  "node_modules",
  ".git",
  ".obsidian"
]);

// src/providers/docstore/watcher.ts
var DEFAULT_DEBOUNCE_MS = 1e3;
var FileWatcher = class {
  root;
  extensions;
  debounceMs;
  onBatch;
  watcher = null;
  debounceTimer = null;
  pendingChanges = /* @__PURE__ */ new Map();
  isPaused = false;
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
    return new Promise((resolve3, reject) => {
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
        resolve3();
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
  pause() {
    this.isPaused = true;
  }
  resume() {
    this.isPaused = false;
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
    if (this.isPaused) return;
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
        if (this.pendingChanges.size === 0) {
          if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
          }
          return;
        }
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
var normalizeWikiLink = normalizeLinkTarget;
function buildFilenameIndex(nodes) {
  const index = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    const path = node.sourceRef?.path ?? "";
    const titleKey = node.title.toLowerCase();
    if (!titleKey && !path) {
      console.warn(
        `Node ${node.id} has no title or path \u2014 link resolution will fail`
      );
    }
    if (titleKey) {
      const existing = index.get(titleKey) ?? [];
      existing.push(node.id);
      index.set(titleKey, existing);
    }
    if (path) {
      const filename = path.split("/").pop()?.replace(/\.[^.]+$/, "").toLowerCase();
      if (filename && filename !== titleKey) {
        const existing = index.get(filename) ?? [];
        existing.push(node.id);
        index.set(filename, existing);
      }
    }
  }
  for (const ids of index.values()) {
    ids.sort();
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
    const lookupKey = link.replace(/\.md$/i, "").toLowerCase();
    const matches = filenameIndex.get(lookupKey);
    if (matches && matches.length > 0) {
      return matches[0];
    }
    const variant = spaceDashVariant(lookupKey);
    if (variant) {
      const variantMatches = filenameIndex.get(variant);
      if (variantMatches && variantMatches.length > 0) {
        return variantMatches[0];
      }
    }
    return link;
  });
}
function spaceDashVariant(filename) {
  const hasSpace = filename.includes(" ");
  const hasDash = filename.includes("-");
  if (hasSpace && !hasDash) {
    return filename.replace(/ /g, "-");
  }
  if (hasDash && !hasSpace) {
    return filename.replace(/-/g, " ");
  }
  return null;
}

// src/providers/docstore/file-operations.ts
import { readFile as readFile2, stat, readdir } from "fs/promises";
import { join as join5, resolve, extname as extname2 } from "path";
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
    const fullPath = join5(dir, entry.name);
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
  return readFile2(filePath, "utf-8");
}

// src/providers/docstore/id.ts
import { nanoid } from "nanoid";
var NANOID_PATTERN = /^[A-Za-z0-9_-]{12}$/;
var isValidId = (id) => NANOID_PATTERN.test(id);
var generateId = () => nanoid(12);

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
   * Validates frontmatter ID and signals if writeback is needed.
   * Throws if no reader is registered for the extension.
   *
   * Note: Does NOT generate new IDs here - that happens in Phase 3's writeback.
   * Files without valid frontmatter IDs keep their path-based ID for now,
   * with needsIdWrite: true signaling that an ID should be generated and written.
   */
  parse(content, context) {
    const reader = this.getReader(context.extension);
    if (!reader) {
      throw new Error(`No reader registered for extension: ${context.extension}`);
    }
    const node = reader.parse(content, context);
    const needsIdWrite = !isValidId(node.id);
    return { node, needsIdWrite };
  }
};

// src/providers/docstore/readers/markdown.ts
var MarkdownReader = class {
  extensions = [".md", ".markdown"];
  parse(content, context) {
    const parsed = parseMarkdown(content);
    const id = parsed.id ?? normalizeId(context.relativePath);
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
  id;
  cache;
  sourceRoot;
  ownsVectorIndex;
  registry;
  fileWatcher = null;
  onChangeCallback;
  constructor(options) {
    const {
      sourceRoot,
      cacheDir,
      id = "docstore",
      vectorIndex,
      registry,
      fileWatcher
    } = options;
    const ownsVector = !vectorIndex;
    if (!vectorIndex) mkdirSync2(cacheDir, { recursive: true });
    const vi = vectorIndex ?? new SqliteVectorIndex(cacheDir);
    super({ vectorIndex: vi });
    this.id = id;
    this.sourceRoot = sourceRoot;
    this.cache = new Cache(cacheDir);
    this.ownsVectorIndex = ownsVector;
    this.registry = registry ?? createDefaultRegistry();
    this.fileWatcher = fileWatcher ?? null;
  }
  async sync() {
    if (this.fileWatcher?.isWatching()) {
      this.fileWatcher.pause();
    }
    try {
      const extensions = this.registry.getExtensions();
      const currentPaths = await collectFiles(this.sourceRoot, extensions);
      const trackedPaths = this.cache.getAllTrackedPaths();
      const seenIds = /* @__PURE__ */ new Map();
      for (const filePath of currentPaths) {
        try {
          const mtime = await getFileMtime(filePath);
          const cachedMtime = this.cache.getModifiedTime(filePath);
          if (cachedMtime === null || mtime > cachedMtime) {
            const { node, needsIdWrite, newMtime } = await this.parseAndMaybeWriteId(filePath, mtime);
            const existingPath = seenIds.get(node.id);
            if (existingPath) {
              console.warn(
                `Duplicate ID ${node.id} found in ${filePath} (first seen in ${existingPath}):`,
                new Error("Skipping duplicate")
              );
              continue;
            }
            seenIds.set(node.id, filePath);
            const finalMtime = needsIdWrite ? newMtime ?? mtime : mtime;
            this.cache.upsertNode(node, "file", filePath, finalMtime);
          } else {
            const existingNode = this.cache.getNodeByPath(filePath);
            if (existingNode) {
              const existingPath = seenIds.get(existingNode.id);
              if (existingPath) {
                console.warn(
                  `Duplicate ID ${existingNode.id} found in ${filePath} (first seen in ${existingPath}):`,
                  new Error("Skipping duplicate")
                );
                this.cache.deleteNode(existingNode.id);
              } else {
                seenIds.set(existingNode.id, filePath);
              }
            }
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
    } finally {
      if (this.fileWatcher?.isWatching()) {
        this.fileWatcher.resume();
      }
    }
  }
  async createNode(node) {
    const normalizedPath = normalizeId(node.id);
    validatePathWithinSource(this.sourceRoot, normalizedPath);
    const existingByPath = this.cache.getNodeByPath(join6(this.sourceRoot, normalizedPath));
    if (existingByPath) {
      throw new Error(`Node already exists: ${normalizedPath}`);
    }
    const filePath = join6(this.sourceRoot, normalizedPath);
    const dir = dirname(filePath);
    await mkdir2(dir, { recursive: true });
    const stableId = generateId();
    const rawLinks = extractWikiLinks(node.content);
    const parsed = {
      id: stableId,
      title: node.title,
      tags: node.tags,
      properties: node.properties,
      content: node.content,
      rawLinks
    };
    const markdown = serializeToMarkdown(parsed);
    await writeFile2(filePath, markdown, "utf-8");
    let outgoingLinks = node.outgoingLinks;
    if (node.content && (!outgoingLinks || outgoingLinks.length === 0)) {
      outgoingLinks = rawLinks.map((link) => normalizeWikiLink(link));
    }
    const mtime = await getFileMtime(filePath);
    const createdNode = {
      ...node,
      id: stableId,
      outgoingLinks,
      sourceRef: {
        type: "file",
        path: filePath,
        lastModified: new Date(mtime)
      }
    };
    this.cache.upsertNode(createdNode, "file", filePath, mtime);
    this.resolveAllLinks();
    await this.syncGraph();
  }
  async updateNode(id, updates) {
    let existing = this.cache.getNode(id);
    if (!existing) {
      const normalizedId = normalizeId(id);
      existing = this.cache.getNode(normalizedId);
    }
    if (!existing && (id.includes(".") || id.includes("/"))) {
      const fullPath = join6(this.sourceRoot, normalizeId(id));
      existing = this.cache.getNodeByPath(fullPath);
    }
    if (!existing) {
      throw new Error(`Node not found: ${id}`);
    }
    const { ...safeUpdates } = updates;
    const contentForLinks = safeUpdates.content ?? existing.content;
    const rawLinks = extractWikiLinks(contentForLinks);
    const outgoingLinks = rawLinks.map((link) => normalizeWikiLink(link));
    const updated = {
      ...existing,
      ...safeUpdates,
      outgoingLinks,
      id: existing.id
      // Preserve original ID
    };
    const filePath = existing.sourceRef?.path ?? join6(this.sourceRoot, existing.id);
    const parsed = {
      id: existing.id,
      // Write the stable ID back to frontmatter
      title: updated.title,
      tags: updated.tags,
      properties: updated.properties,
      content: updated.content,
      rawLinks
    };
    const markdown = serializeToMarkdown(parsed);
    await writeFile2(filePath, markdown, "utf-8");
    const mtime = await getFileMtime(filePath);
    this.cache.upsertNode(updated, "file", filePath, mtime);
    this.resolveAllLinks();
    await this.syncGraph();
  }
  async deleteNode(id) {
    let existing = this.cache.getNode(id);
    if (!existing) {
      const normalizedId = normalizeId(id);
      existing = this.cache.getNode(normalizedId);
    }
    if (!existing && (id.includes(".") || id.includes("/"))) {
      const fullPath = join6(this.sourceRoot, normalizeId(id));
      existing = this.cache.getNodeByPath(fullPath);
    }
    if (!existing) {
      throw new Error(`Node not found: ${id}`);
    }
    const filePath = existing.sourceRef?.path ?? join6(this.sourceRoot, existing.id);
    await rm(filePath);
    this.cache.deleteNode(existing.id);
    if (this.vectorIndex) await this.vectorIndex.delete(existing.id);
    await this.syncGraph();
  }
  async getNode(id) {
    let node = this.cache.getNode(id);
    if (node) return node;
    const normalizedId = normalizeId(id);
    if (normalizedId !== id) {
      node = this.cache.getNode(normalizedId);
      if (node) return node;
    }
    if (id.includes(".") || id.includes("/")) {
      const fullPath = join6(this.sourceRoot, normalizedId);
      node = this.cache.getNodeByPath(fullPath);
    }
    return node;
  }
  async getNodes(ids) {
    const results = [];
    for (const id of ids) {
      const node = await this.getNode(id);
      if (node) results.push(node);
    }
    return results;
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
    const result = /* @__PURE__ */ new Map();
    for (const id of ids) {
      const node = await this.getNode(id);
      result.set(normalizeId(id), node !== null);
    }
    return result;
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
  // Lifecycle hooks
  async onRegister() {
    await this.sync();
  }
  async onUnregister() {
    this.close();
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
    this.fileWatcher?.pause();
    const processedIds = [];
    try {
      for (const [pathId, event] of events) {
        const filePath = join6(this.sourceRoot, pathId);
        try {
          if (event === "unlink") {
            const existing = this.cache.getNodeByPath(filePath);
            if (existing) {
              this.cache.deleteNode(existing.id);
              if (this.vectorIndex) {
                try {
                  await this.vectorIndex.delete(existing.id);
                } catch (vectorErr) {
                  console.warn(`Vector delete failed for ${pathId}:`, vectorErr);
                }
              }
              processedIds.push(existing.id);
            }
          } else {
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
                }
              }
            }
            this.cache.upsertNode(node, "file", filePath, finalMtime);
            processedIds.push(node.id);
          }
        } catch (err) {
          console.warn(`Failed to process file change for ${pathId}:`, err);
        }
      }
      if (processedIds.length > 0) {
        this.resolveAllLinks();
        await this.syncGraph();
      }
      if (this.onChangeCallback && processedIds.length > 0) {
        this.onChangeCallback(processedIds);
      }
    } finally {
      this.fileWatcher?.resume();
    }
  }
  resolveAllLinks() {
    const nodes = this.cache.getAllNodes();
    const filenameIndex = buildFilenameIndex(nodes);
    const validNodeIds = new Set(nodes.map((n) => n.id));
    const pathToId = /* @__PURE__ */ new Map();
    for (const node of nodes) {
      if (node.sourceRef?.path) {
        const relativePath = relative2(this.sourceRoot, node.sourceRef.path);
        const normalizedPath = normalizeId(relativePath);
        pathToId.set(normalizedPath, node.id);
      }
    }
    for (const node of nodes) {
      const resolvedIds = resolveLinks(
        node.outgoingLinks,
        filenameIndex,
        validNodeIds
      );
      const finalIds = resolvedIds.map((link) => {
        if (validNodeIds.has(link)) {
          return link;
        }
        const stableId = pathToId.get(link);
        return stableId ?? link;
      });
      if (finalIds.some((r, i) => r !== node.outgoingLinks[i])) {
        this.cache.updateOutgoingLinks(node.id, finalIds);
      }
    }
  }
  // ── Graph operations (override for path-based lookup) ─────
  async getNeighbors(id, options) {
    const node = await this.getNode(id);
    if (!node) return [];
    return super.getNeighbors(node.id, options);
  }
  async findPath(source, target) {
    const sourceNode = await this.getNode(source);
    const targetNode = await this.getNode(target);
    if (!sourceNode || !targetNode) return null;
    return super.findPath(sourceNode.id, targetNode.id);
  }
  async getHubs(metric, limit) {
    return super.getHubs(metric, limit);
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
   * Parse a file and optionally write a generated ID back if missing.
   * Returns the node (with stable ID) and whether a write occurred.
   */
  async parseAndMaybeWriteId(filePath, originalMtime) {
    const content = await readFileContent(filePath);
    const relativePath = relative2(this.sourceRoot, filePath);
    const ext = extname3(filePath).toLowerCase();
    const actualMtime = new Date(originalMtime);
    const context = {
      absolutePath: filePath,
      relativePath,
      extension: ext,
      mtime: actualMtime
    };
    const { node, needsIdWrite } = this.registry.parse(content, context);
    if (!needsIdWrite) {
      return { node, needsIdWrite: false };
    }
    const newId = generateId();
    const writebackSuccess = await this.writeIdBack(filePath, newId, originalMtime, content);
    if (!writebackSuccess) {
      console.warn(`File modified during sync, skipping ID writeback: ${filePath}`);
      return { node, needsIdWrite: true };
    }
    const updatedNode = {
      ...node,
      id: newId
    };
    const newMtime = await getFileMtime(filePath);
    return { node: updatedNode, needsIdWrite: true, newMtime };
  }
  /**
   * Write a generated ID back to file's frontmatter.
   * Returns false if file was modified since originalMtime (race condition).
   */
  async writeIdBack(filePath, nodeId, originalMtime, originalContent) {
    const currentStat = await stat2(filePath);
    if (currentStat.mtimeMs !== originalMtime) {
      return false;
    }
    const parsed = parseMarkdown(originalContent);
    parsed.id = nodeId;
    const newContent = serializeToMarkdown(parsed);
    await writeFile2(filePath, newContent, "utf-8");
    return true;
  }
};

// src/providers/embedding/transformers.ts
import { pipeline } from "@xenova/transformers";
var DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";
var DEFAULT_DIMENSIONS = 384;
var TransformersEmbedding = class {
  id;
  model;
  dims;
  pipe = null;
  constructor(options = {}) {
    const {
      model = DEFAULT_MODEL,
      dimensions = DEFAULT_DIMENSIONS,
      id = "transformers-embedding"
    } = options;
    this.id = id;
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
  // Lifecycle hooks
  async onRegister() {
  }
  async onUnregister() {
    this.pipe = null;
  }
};

// src/types/provider.ts
function isStoreProvider(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const obj = value;
  return typeof obj.id === "string" && obj.id.trim().length > 0 && typeof obj.createNode === "function" && typeof obj.updateNode === "function" && typeof obj.deleteNode === "function" && typeof obj.getNode === "function" && typeof obj.getNodes === "function" && typeof obj.getNeighbors === "function" && typeof obj.findPath === "function" && typeof obj.getHubs === "function" && typeof obj.storeEmbedding === "function" && typeof obj.searchByVector === "function" && typeof obj.searchByTags === "function" && typeof obj.getRandomNode === "function" && typeof obj.resolveTitles === "function" && typeof obj.listNodes === "function" && typeof obj.resolveNodes === "function" && typeof obj.nodesExist === "function";
}
function isEmbeddingProvider(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const obj = value;
  return typeof obj.id === "string" && obj.id.trim().length > 0 && typeof obj.embed === "function" && typeof obj.embedBatch === "function" && typeof obj.dimensions === "function" && typeof obj.modelId === "function";
}

// src/core/graphcore.ts
var GraphCoreImpl = class _GraphCoreImpl {
  store = null;
  embedding = null;
  async registerStore(provider) {
    if (!provider) {
      throw new Error("Store provider is required");
    }
    if (!isStoreProvider(provider)) {
      throw new Error("Invalid Store provider: missing required methods or id");
    }
    if (this.store?.onUnregister) {
      try {
        await this.store.onUnregister();
      } catch (err) {
        console.warn("Error during store onUnregister:", err);
      }
    }
    this.store = provider;
    if (provider.onRegister) {
      try {
        await provider.onRegister();
      } catch (err) {
        this.store = null;
        throw err;
      }
    }
  }
  async registerEmbedding(provider) {
    if (!provider) {
      throw new Error("Embedding provider is required");
    }
    if (!isEmbeddingProvider(provider)) {
      throw new Error("Invalid Embedding provider: missing required methods or id");
    }
    if (this.embedding?.onUnregister) {
      try {
        await this.embedding.onUnregister();
      } catch (err) {
        console.warn("Error during embedding onUnregister:", err);
      }
    }
    this.embedding = provider;
    if (provider.onRegister) {
      try {
        await provider.onRegister();
      } catch (err) {
        this.embedding = null;
        throw err;
      }
    }
  }
  async destroy() {
    if (this.embedding?.onUnregister) {
      try {
        await this.embedding.onUnregister();
      } catch (err) {
        console.warn("Error during embedding onUnregister in destroy:", err);
      }
    }
    if (this.store?.onUnregister) {
      try {
        await this.store.onUnregister();
      } catch (err) {
        console.warn("Error during store onUnregister in destroy:", err);
      }
    }
    this.embedding = null;
    this.store = null;
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
  static async fromConfig(config) {
    if (!config.providers?.store) {
      throw new Error("Store configuration is required");
    }
    const core = new _GraphCoreImpl();
    try {
      if (config.providers.store.type === "docstore") {
        const sourcePath = config.source?.path ?? ".";
        const cachePath = config.cache?.path ?? ".roux";
        const store = new DocStore({ sourceRoot: sourcePath, cacheDir: cachePath });
        await core.registerStore(store);
      } else {
        throw new Error(
          `Unsupported store provider type: ${config.providers.store.type}. Supported: docstore`
        );
      }
      const embeddingConfig = config.providers.embedding;
      if (!embeddingConfig || embeddingConfig.type === "local") {
        const model = embeddingConfig?.model;
        const embedding = new TransformersEmbedding(model ? { model } : {});
        await core.registerEmbedding(embedding);
      } else {
        throw new Error(
          `Unsupported embedding provider type: ${embeddingConfig.type}. Supported: local`
        );
      }
      return core;
    } catch (err) {
      await core.destroy();
      throw err;
    }
  }
};

// src/mcp/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

// src/types/config.ts
var DEFAULT_NAMING = {
  filename: "space",
  title: "title"
};

// src/index.ts
var VERSION = "0.1.3";

// src/mcp/types.ts
var McpError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "McpError";
  }
  toResponse() {
    return {
      error: {
        code: this.code,
        message: this.message
      }
    };
  }
};

// src/mcp/handlers/search.ts
var search_exports = {};
__export(search_exports, {
  handler: () => handler,
  schema: () => schema
});

// src/mcp/validation.ts
function coerceInt(value, defaultValue, minValue, fieldName) {
  if (value === void 0 || value === null) {
    return defaultValue;
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return defaultValue;
  }
  const floored = Math.floor(num);
  if (floored < minValue) {
    throw new McpError("INVALID_PARAMS", `${fieldName} must be at least ${minValue}`);
  }
  return floored;
}
function coerceLimit(value, defaultValue) {
  return coerceInt(value, defaultValue, 1, "limit");
}
function coerceOffset(value, defaultValue) {
  return coerceInt(value, defaultValue, 0, "offset");
}
function coerceDepth(value) {
  if (value === void 0 || value === null) {
    return 0;
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return 0;
  }
  return num >= 1 ? 1 : 0;
}
function validateStringArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new McpError("INVALID_PARAMS", `${fieldName} is required and must be an array`);
  }
  if (!value.every((item) => typeof item === "string")) {
    throw new McpError("INVALID_PARAMS", `${fieldName} must contain only strings`);
  }
  return value;
}
function validateRequiredString(value, fieldName) {
  if (value === void 0 || value === null || typeof value !== "string") {
    throw new McpError("INVALID_PARAMS", `${fieldName} is required and must be a string`);
  }
  return value;
}
function validateEnum(value, validValues, fieldName, defaultValue) {
  if (value === void 0 || value === null) {
    return defaultValue;
  }
  if (!validValues.includes(value)) {
    throw new McpError(
      "INVALID_PARAMS",
      `${fieldName} must be one of: ${validValues.join(", ")}`
    );
  }
  return value;
}
function validateOptionalTags(value) {
  if (value === void 0) {
    return void 0;
  }
  if (!Array.isArray(value)) {
    throw new McpError("INVALID_PARAMS", "tags must contain only strings");
  }
  if (!value.every((t) => typeof t === "string")) {
    throw new McpError("INVALID_PARAMS", "tags must contain only strings");
  }
  return value;
}
function validateRequiredTags(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new McpError("INVALID_PARAMS", "tags is required and must be a non-empty array");
  }
  if (!value.every((t) => typeof t === "string")) {
    throw new McpError("INVALID_PARAMS", "tags must contain only strings");
  }
  return value;
}

// src/mcp/truncate.ts
var TRUNCATION_LIMITS = {
  /** Primary node (get_node, single result) */
  primary: 1e4,
  /** List results (search, neighbors) */
  list: 500,
  /** Neighbor nodes in context */
  neighbor: 200
};
var TRUNCATION_SUFFIX = "... [truncated]";
function truncateContent(content, context) {
  const limit = TRUNCATION_LIMITS[context];
  if (content.length <= limit) {
    return content;
  }
  let truncatedLength = Math.max(0, limit - TRUNCATION_SUFFIX.length);
  if (truncatedLength > 0) {
    const lastCharCode = content.charCodeAt(truncatedLength - 1);
    if (lastCharCode >= 55296 && lastCharCode <= 56319) {
      truncatedLength--;
    }
  }
  return content.slice(0, truncatedLength) + TRUNCATION_SUFFIX;
}

// src/mcp/transforms.ts
var MAX_NEIGHBORS = 20;
var MAX_LINKS_TO_RESOLVE = 100;
async function nodeToResponse(node, store, truncation) {
  const linksToResolve = node.outgoingLinks.slice(0, MAX_LINKS_TO_RESOLVE);
  const titles = await store.resolveTitles(linksToResolve);
  const links = linksToResolve.map((id) => ({
    id,
    title: titles.get(id) ?? id
  }));
  return {
    id: node.id,
    title: node.title,
    content: truncateContent(node.content, truncation),
    tags: node.tags,
    links,
    properties: node.properties
  };
}
async function nodesToResponses(nodes, store, truncation, includeContent) {
  const allLinkIds = /* @__PURE__ */ new Set();
  const nodeLinkLimits = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    const limitedLinks = node.outgoingLinks.slice(0, MAX_LINKS_TO_RESOLVE);
    nodeLinkLimits.set(node.id, limitedLinks);
    for (const linkId of limitedLinks) {
      allLinkIds.add(linkId);
    }
  }
  const titles = await store.resolveTitles(Array.from(allLinkIds));
  return nodes.map((node) => {
    const limitedLinks = nodeLinkLimits.get(node.id);
    const base = {
      id: node.id,
      title: node.title,
      tags: node.tags,
      links: limitedLinks.map((id) => ({
        id,
        title: titles.get(id) ?? id
      })),
      properties: node.properties
    };
    if (includeContent) {
      return {
        ...base,
        content: truncateContent(node.content, truncation)
      };
    }
    return base;
  });
}
async function nodeToContextResponse(node, incomingNeighbors, outgoingNeighbors, store) {
  const primary = await nodeToResponse(node, store, "primary");
  const limitedIncoming = incomingNeighbors.slice(0, MAX_NEIGHBORS);
  const limitedOutgoing = outgoingNeighbors.slice(0, MAX_NEIGHBORS);
  const [incomingResponses, outgoingResponses] = await Promise.all([
    nodesToResponses(limitedIncoming, store, "neighbor", true),
    nodesToResponses(limitedOutgoing, store, "neighbor", true)
  ]);
  return {
    ...primary,
    incomingNeighbors: incomingResponses,
    outgoingNeighbors: outgoingResponses,
    incomingCount: incomingNeighbors.length,
    outgoingCount: outgoingNeighbors.length
  };
}
async function nodesToSearchResults(nodes, scores, store, includeContent) {
  const responses = await nodesToResponses(nodes, store, "list", includeContent);
  return responses.map((response) => ({
    ...response,
    score: scores.get(response.id) ?? 0
  }));
}
async function hubsToResponses(hubs, store) {
  const ids = hubs.map(([id]) => id);
  const titles = await store.resolveTitles(ids);
  return hubs.map(([id, score]) => ({
    id,
    title: titles.get(id) ?? id,
    score
  }));
}
function pathToResponse(path) {
  return {
    path,
    length: path.length - 1
  };
}

// src/mcp/handlers/search.ts
var schema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Natural language search query"
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 50,
      default: 10,
      description: "Maximum results to return"
    },
    include_content: {
      type: "boolean",
      default: false,
      description: "Include node content in results. Default false returns metadata only (id, title, tags, properties, links). Set true to include truncated content."
    }
  },
  required: ["query"]
};
async function handler(ctx, args) {
  if (!ctx.hasEmbedding) {
    throw new McpError("PROVIDER_ERROR", "Search requires embedding provider");
  }
  const query = args.query;
  const limit = coerceLimit(args.limit, 10);
  const includeContent = args.include_content === true;
  if (typeof query !== "string" || query.trim() === "") {
    throw new McpError("INVALID_PARAMS", "query is required and must be a non-empty string");
  }
  const nodes = await ctx.core.search(query, { limit });
  const scores = /* @__PURE__ */ new Map();
  nodes.forEach((node, index) => {
    scores.set(node.id, Math.max(0, 1 - index * 0.05));
  });
  return nodesToSearchResults(nodes, scores, ctx.store, includeContent);
}

// src/mcp/handlers/get_node.ts
var get_node_exports = {};
__export(get_node_exports, {
  handler: () => handler2,
  schema: () => schema2
});
var schema2 = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: 'Node ID (file path for DocStore). ID is normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").'
    },
    depth: {
      type: "integer",
      minimum: 0,
      maximum: 1,
      default: 0,
      description: "0 = node only, 1 = include neighbors"
    }
  },
  required: ["id"]
};
async function handler2(ctx, args) {
  const id = validateRequiredString(args.id, "id");
  const depth = coerceDepth(args.depth);
  const node = await ctx.core.getNode(id, depth);
  if (!node) {
    return null;
  }
  if (depth === 0) {
    return nodeToResponse(node, ctx.store, "primary");
  }
  const [incomingNeighbors, outgoingNeighbors] = await Promise.all([
    ctx.core.getNeighbors(id, { direction: "in" }),
    ctx.core.getNeighbors(id, { direction: "out" })
  ]);
  return nodeToContextResponse(node, incomingNeighbors, outgoingNeighbors, ctx.store);
}

// src/mcp/handlers/get_neighbors.ts
var get_neighbors_exports = {};
__export(get_neighbors_exports, {
  handler: () => handler3,
  schema: () => schema3
});
var VALID_DIRECTIONS = ["in", "out", "both"];
var schema3 = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: 'Source node ID. ID is normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").'
    },
    direction: {
      type: "string",
      enum: ["in", "out", "both"],
      default: "both",
      description: "in = nodes linking here, out = nodes linked to, both = all"
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 50,
      default: 20,
      description: "Maximum neighbors to return"
    },
    include_content: {
      type: "boolean",
      default: false,
      description: "Include node content in results. Default false returns metadata only (id, title, tags, properties, links). Set true to include truncated content."
    }
  },
  required: ["id"]
};
async function handler3(ctx, args) {
  const id = validateRequiredString(args.id, "id");
  const limit = coerceLimit(args.limit, 20);
  const includeContent = args.include_content === true;
  const direction = validateEnum(args.direction, VALID_DIRECTIONS, "direction", "both");
  const neighbors = await ctx.core.getNeighbors(id, { direction, limit });
  return nodesToResponses(neighbors, ctx.store, "list", includeContent);
}

// src/mcp/handlers/find_path.ts
var find_path_exports = {};
__export(find_path_exports, {
  handler: () => handler4,
  schema: () => schema4
});
var schema4 = {
  type: "object",
  properties: {
    source: {
      type: "string",
      description: 'Start node ID. ID is normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").'
    },
    target: {
      type: "string",
      description: 'End node ID. ID is normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").'
    }
  },
  required: ["source", "target"]
};
async function handler4(ctx, args) {
  const source = validateRequiredString(args.source, "source");
  const target = validateRequiredString(args.target, "target");
  const path = await ctx.core.findPath(source, target);
  if (!path) {
    return null;
  }
  return pathToResponse(path);
}

// src/mcp/handlers/get_hubs.ts
var get_hubs_exports = {};
__export(get_hubs_exports, {
  handler: () => handler5,
  schema: () => schema5
});
var VALID_METRICS = ["in_degree", "out_degree"];
var schema5 = {
  type: "object",
  properties: {
    metric: {
      type: "string",
      enum: ["in_degree", "out_degree"],
      default: "in_degree",
      description: "Centrality metric"
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 50,
      default: 10,
      description: "Maximum results"
    }
  }
};
async function handler5(ctx, args) {
  const limit = coerceLimit(args.limit, 10);
  const metric = validateEnum(args.metric, VALID_METRICS, "metric", "in_degree");
  const hubs = await ctx.core.getHubs(metric, limit);
  return hubsToResponses(hubs, ctx.store);
}

// src/mcp/handlers/search_by_tags.ts
var search_by_tags_exports = {};
__export(search_by_tags_exports, {
  handler: () => handler6,
  schema: () => schema6
});
var VALID_TAG_MODES = ["any", "all"];
var schema6 = {
  type: "object",
  properties: {
    tags: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      description: "Tags to match"
    },
    mode: {
      type: "string",
      enum: ["any", "all"],
      default: "any",
      description: "any = OR matching, all = AND matching"
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 100,
      default: 20,
      description: "Maximum results"
    },
    include_content: {
      type: "boolean",
      default: false,
      description: "Include node content in results. Default false returns metadata only."
    }
  },
  required: ["tags"]
};
async function handler6(ctx, args) {
  const tags = validateRequiredTags(args.tags);
  const limit = coerceLimit(args.limit, 20);
  const includeContent = args.include_content === true;
  const mode = validateEnum(args.mode, VALID_TAG_MODES, "mode", "any");
  const nodes = await ctx.core.searchByTags(tags, mode, limit);
  return nodesToResponses(nodes, ctx.store, "list", includeContent);
}

// src/mcp/handlers/random_node.ts
var random_node_exports = {};
__export(random_node_exports, {
  handler: () => handler7,
  schema: () => schema7
});
var schema7 = {
  type: "object",
  properties: {
    tags: {
      type: "array",
      items: { type: "string" },
      description: "Optional: limit to nodes with these tags (any match)"
    }
  }
};
async function handler7(ctx, args) {
  const tags = validateOptionalTags(args.tags);
  const node = await ctx.core.getRandomNode(tags);
  if (!node) {
    return null;
  }
  return nodeToResponse(node, ctx.store, "primary");
}

// src/mcp/handlers/create_node.ts
var create_node_exports = {};
__export(create_node_exports, {
  deriveTitle: () => deriveTitle,
  handler: () => handler8,
  normalizeCreateId: () => normalizeCreateId,
  schema: () => schema8
});
var schema8 = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: 'Full path for new node (must end in .md). Will be lowercased (spaces and special characters preserved). Example: "notes/My Note.md" creates "notes/my note.md"'
    },
    title: {
      type: "string",
      description: "Optional display title. Defaults to filename without .md extension."
    },
    content: {
      type: "string",
      description: "Full text content (markdown)"
    },
    tags: {
      type: "array",
      items: { type: "string" },
      default: [],
      description: "Classification tags"
    }
  },
  required: ["id", "content"]
};
function normalizeCreateId(rawId, naming = DEFAULT_NAMING) {
  let normalized = rawId.replace(/\\/g, "/").toLowerCase();
  if (naming.filename === "space") {
    normalized = normalized.replace(/-/g, " ");
  } else {
    normalized = normalized.replace(/ /g, "-");
  }
  return normalized;
}
function deriveTitle(id, naming) {
  const basename = id.split("/").pop() || "";
  const rawTitle = basename.replace(/\.md$/i, "");
  if (!rawTitle || !/[a-zA-Z0-9]/.test(rawTitle)) {
    return "Untitled";
  }
  if (!naming) {
    return rawTitle;
  }
  const spaced = naming.filename === "dash" ? rawTitle.replace(/-/g, " ") : rawTitle;
  switch (naming.title) {
    case "title":
      return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
    case "sentence":
      return spaced.charAt(0).toUpperCase() + spaced.slice(1);
    case "as-is":
      return rawTitle;
  }
}
async function handler8(ctx, args) {
  const idRaw = validateRequiredString(args.id, "id");
  if (!idRaw.toLowerCase().endsWith(".md")) {
    throw new McpError("INVALID_PARAMS", "id must end with .md extension");
  }
  const content = validateRequiredString(args.content, "content");
  const titleRaw = args.title;
  const tags = validateOptionalTags(args.tags) ?? [];
  const id = normalizeCreateId(idRaw, ctx.naming);
  const title = titleRaw ?? deriveTitle(id, ctx.naming);
  const existing = await ctx.core.getNode(id);
  if (existing) {
    throw new McpError("NODE_EXISTS", `Node already exists: ${id}`);
  }
  const node = await ctx.core.createNode({
    id,
    title,
    content,
    tags
  });
  return nodeToResponse(node, ctx.store, "primary");
}

// src/mcp/handlers/update_node.ts
var update_node_exports = {};
__export(update_node_exports, {
  handler: () => handler9,
  schema: () => schema9
});
var schema9 = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: 'Node ID to update. ID is normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").'
    },
    title: {
      type: "string",
      description: "New title (renames file for DocStore)"
    },
    content: {
      type: "string",
      description: "New content (replaces entirely)"
    },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "New tags (replaces existing)"
    }
  },
  required: ["id"]
};
async function handler9(ctx, args) {
  const id = validateRequiredString(args.id, "id");
  const title = args.title;
  const content = args.content;
  const tags = validateOptionalTags(args.tags);
  if (title === void 0 && content === void 0 && tags === void 0) {
    throw new McpError(
      "INVALID_PARAMS",
      "At least one of title, content, or tags must be provided"
    );
  }
  const existing = await ctx.core.getNode(id);
  if (!existing) {
    throw new McpError("NODE_NOT_FOUND", `Node not found: ${id}`);
  }
  if (title !== void 0 && title !== existing.title) {
    const incomingNeighbors = await ctx.core.getNeighbors(id, { direction: "in" });
    if (incomingNeighbors.length > 0) {
      throw new McpError(
        "LINK_INTEGRITY",
        `Cannot rename node with ${incomingNeighbors.length} incoming links`
      );
    }
  }
  const updates = {};
  if (title !== void 0) updates.title = title;
  if (content !== void 0) updates.content = content;
  if (tags !== void 0) updates.tags = tags;
  const updated = await ctx.core.updateNode(id, updates);
  return nodeToResponse(updated, ctx.store, "primary");
}

// src/mcp/handlers/delete_node.ts
var delete_node_exports = {};
__export(delete_node_exports, {
  handler: () => handler10,
  schema: () => schema10
});
var schema10 = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: 'Node ID to delete. ID is normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").'
    }
  },
  required: ["id"]
};
async function handler10(ctx, args) {
  const id = validateRequiredString(args.id, "id");
  const deleted = await ctx.core.deleteNode(id);
  return { deleted };
}

// src/mcp/handlers/list_nodes.ts
var list_nodes_exports = {};
__export(list_nodes_exports, {
  handler: () => handler11,
  schema: () => schema11
});
var schema11 = {
  type: "object",
  properties: {
    tag: {
      type: "string",
      description: 'Filter by tag from the "tags" frontmatter array (case-insensitive). Does NOT search other frontmatter fields like "type" or "category".'
    },
    path: {
      type: "string",
      description: "Filter by path prefix (startsWith, case-insensitive)"
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 1e3,
      default: 100,
      description: "Maximum results to return"
    },
    offset: {
      type: "integer",
      minimum: 0,
      default: 0,
      description: "Skip this many results (for pagination)"
    }
  }
};
async function handler11(ctx, args) {
  const tag = args.tag;
  const path = args.path;
  const limit = coerceLimit(args.limit, 100);
  const offset = coerceOffset(args.offset, 0);
  const filter = {};
  if (tag) filter.tag = tag;
  if (path) filter.path = path;
  return ctx.core.listNodes(filter, { limit, offset });
}

// src/mcp/handlers/resolve_nodes.ts
var resolve_nodes_exports = {};
__export(resolve_nodes_exports, {
  handler: () => handler12,
  schema: () => schema12
});
var VALID_STRATEGIES = ["exact", "fuzzy", "semantic"];
var schema12 = {
  type: "object",
  properties: {
    names: {
      type: "array",
      items: { type: "string" },
      description: "Names to resolve to existing nodes"
    },
    strategy: {
      type: "string",
      enum: ["exact", "fuzzy", "semantic"],
      default: "fuzzy",
      description: 'How to match names to nodes. "exact": case-insensitive title equality. "fuzzy": string similarity (Dice coefficient) \u2014 use for typos, misspellings, partial matches. "semantic": embedding cosine similarity \u2014 use for synonyms or related concepts (NOT typos). Misspellings embed poorly because they produce unrelated vectors.'
    },
    threshold: {
      type: "number",
      minimum: 0,
      maximum: 1,
      default: 0.7,
      description: "Minimum similarity score (0-1). Lower values match more loosely. For typo tolerance, use fuzzy with threshold 0.5-0.6. Ignored for exact strategy."
    },
    tag: {
      type: "string",
      description: 'Filter candidates by tag from "tags" frontmatter array (case-insensitive)'
    },
    path: {
      type: "string",
      description: "Filter candidates by path prefix (case-insensitive)"
    }
  },
  required: ["names"]
};
async function handler12(ctx, args) {
  const names = validateStringArray(args.names, "names");
  const threshold = args.threshold;
  const tag = args.tag;
  const path = args.path;
  const strategy = validateEnum(
    args.strategy,
    VALID_STRATEGIES,
    "strategy",
    "fuzzy"
  );
  if (strategy === "semantic" && !ctx.hasEmbedding) {
    throw new McpError("PROVIDER_ERROR", "Semantic resolution requires embedding provider");
  }
  const options = { strategy };
  if (threshold !== void 0) options.threshold = threshold;
  if (tag) options.tag = tag;
  if (path) options.path = path;
  return ctx.core.resolveNodes(names, options);
}

// src/mcp/handlers/nodes_exist.ts
var nodes_exist_exports = {};
__export(nodes_exist_exports, {
  handler: () => handler13,
  schema: () => schema13
});
var schema13 = {
  type: "object",
  properties: {
    ids: {
      type: "array",
      items: { type: "string" },
      description: 'Node IDs to check existence. IDs are normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").'
    }
  },
  required: ["ids"]
};
async function handler13(ctx, args) {
  const ids = validateStringArray(args.ids, "ids");
  const result = await ctx.store.nodesExist(ids);
  const response = {};
  for (const [id, exists] of result) {
    response[id] = exists;
  }
  return response;
}

// src/mcp/handlers/index.ts
var handlers = {
  search: search_exports,
  get_node: get_node_exports,
  get_neighbors: get_neighbors_exports,
  find_path: find_path_exports,
  get_hubs: get_hubs_exports,
  search_by_tags: search_by_tags_exports,
  random_node: random_node_exports,
  create_node: create_node_exports,
  update_node: update_node_exports,
  delete_node: delete_node_exports,
  list_nodes: list_nodes_exports,
  resolve_nodes: resolve_nodes_exports,
  nodes_exist: nodes_exist_exports
};
var TOOL_DESCRIPTIONS = {
  search: "Semantic similarity search across all nodes",
  get_node: "Retrieve a single node by ID with optional neighbor context",
  get_neighbors: "Get nodes linked to or from a specific node",
  find_path: "Find the shortest path between two nodes",
  get_hubs: "Get the most central nodes by graph metric",
  search_by_tags: "Filter nodes by tags (AND or OR matching)",
  random_node: "Get a random node for discovery, optionally filtered by tags",
  create_node: "Create a new node (writes file for DocStore)",
  update_node: "Update an existing node. Title changes rejected if incoming links exist.",
  delete_node: "Delete a node by ID",
  list_nodes: 'List nodes with optional filters and pagination. Tag filter searches the "tags" frontmatter array only. All IDs returned are lowercase.',
  resolve_nodes: 'Batch resolve names to existing node IDs. Strategy selection: "exact" for known titles, "fuzzy" for typos/misspellings (e.g., "chikken" -> "chicken"), "semantic" for synonyms/concepts (e.g., "poultry leg meat" -> "chicken thigh"). Semantic does NOT handle typos \u2014 misspellings produce garbage embeddings.',
  nodes_exist: "Batch check if node IDs exist. IDs are normalized to lowercase before checking."
};
var asSchema = (s) => s;
function getToolDefinitions(hasEmbedding) {
  const toolOrder = [
    "get_node",
    "get_neighbors",
    "find_path",
    "get_hubs",
    "search_by_tags",
    "random_node",
    "create_node",
    "update_node",
    "delete_node",
    "list_nodes",
    "resolve_nodes",
    "nodes_exist"
  ];
  const tools = toolOrder.map((name) => ({
    name,
    description: TOOL_DESCRIPTIONS[name],
    inputSchema: asSchema(handlers[name].schema)
  }));
  if (hasEmbedding) {
    tools.unshift({
      name: "search",
      description: TOOL_DESCRIPTIONS.search,
      inputSchema: asSchema(handlers.search.schema)
    });
  }
  return tools;
}
async function dispatchTool(ctx, name, args) {
  const h = handlers[name];
  if (!h) {
    throw new McpError("INVALID_PARAMS", `Unknown tool: ${name}`);
  }
  return h.handler(ctx, args);
}

// src/mcp/server.ts
function formatToolResponse(result) {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };
}
function formatErrorResponse(error) {
  if (error instanceof McpError) {
    return {
      content: [{ type: "text", text: JSON.stringify(error.toResponse()) }],
      isError: true
    };
  }
  const mcpError = new McpError(
    "PROVIDER_ERROR",
    error instanceof Error ? error.message : "Unknown error"
  );
  return {
    content: [{ type: "text", text: JSON.stringify(mcpError.toResponse()) }],
    isError: true
  };
}
async function executeToolCall(ctx, name, args) {
  try {
    const result = await dispatchTool(ctx, name, args);
    return formatToolResponse(result);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
var McpServer = class {
  server;
  ctx;
  constructor(options) {
    this.ctx = {
      core: options.core,
      store: options.store,
      hasEmbedding: options.hasEmbedding,
      naming: options.naming ?? DEFAULT_NAMING
    };
    this.server = new Server(
      { name: "roux", version: VERSION },
      { capabilities: { tools: {} } }
    );
    this.setupHandlers();
  }
  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: getToolDefinitions(this.ctx.hasEmbedding)
    }));
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return executeToolCall(this.ctx, name, args ?? {});
    });
  }
  /**
   * Start the server with optional transport factory.
   * @param transportFactory Factory to create transport. Defaults to StdioServerTransport.
   */
  async start(transportFactory) {
    const transport = transportFactory ? transportFactory() : new StdioServerTransport();
    await this.server.connect(transport);
  }
  async close() {
    await this.server.close();
  }
};

// src/cli/commands/serve.ts
async function serveCommand(directory, options = {}) {
  const { watch: watch2 = true, transportFactory, onProgress } = options;
  const configPath = join7(directory, "roux.yaml");
  try {
    await access3(configPath);
  } catch {
    throw new Error(`Directory not initialized. Run 'roux init' first.`);
  }
  const configContent = await readFile3(configPath, "utf-8");
  const config = parseYaml(configContent);
  const sourcePath = config.source?.path ?? ".";
  const resolvedSourcePath = join7(directory, sourcePath);
  const cachePath = config.cache?.path ?? ".roux";
  const resolvedCachePath = join7(directory, cachePath);
  const store = new DocStore({ sourceRoot: resolvedSourcePath, cacheDir: resolvedCachePath });
  const embeddingModel = config.providers?.embedding?.type === "local" ? config.providers.embedding.model : void 0;
  const embedding = new TransformersEmbedding(
    embeddingModel ? { model: embeddingModel } : {}
  );
  const core = new GraphCoreImpl();
  await core.registerStore(store);
  await core.registerEmbedding(embedding);
  const allNodeIds = await store.getAllNodeIds();
  const total = allNodeIds.length;
  for (let i = 0; i < allNodeIds.length; i++) {
    const id = allNodeIds[i];
    if (!hasExistingEmbedding(store, id)) {
      const node = await store.getNode(id);
      if (node && node.content) {
        const vector = await embedding.embed(node.content);
        await store.storeEmbedding(id, vector, embedding.modelId());
      }
    }
    if (onProgress) {
      onProgress(i + 1, total);
    }
  }
  const naming = { ...DEFAULT_NAMING, ...config.naming };
  const mcpServer = new McpServer({
    core,
    store,
    hasEmbedding: true,
    naming
  });
  try {
    await mcpServer.start(transportFactory);
  } catch (err) {
    await core.destroy();
    throw err;
  }
  if (watch2) {
    try {
      await store.startWatching(async (changedIds) => {
        for (const id of changedIds) {
          try {
            const node = await store.getNode(id);
            if (node && node.content) {
              const vector = await embedding.embed(node.content);
              await store.storeEmbedding(id, vector, embedding.modelId());
            }
          } catch (err) {
            console.warn(
              "Failed to generate embedding for",
              id,
              ":",
              err.message || "Unknown error"
            );
          }
        }
      });
    } catch (err) {
      console.warn(
        "File watching disabled:",
        err.message || "Unknown error"
      );
    }
  }
  return {
    stop: async () => {
      await core.destroy();
      await mcpServer.close();
    },
    isWatching: store.isWatching(),
    nodeCount: allNodeIds.length
  };
}
function hasExistingEmbedding(store, id) {
  return store.hasEmbedding(id);
}

// src/cli/commands/viz.ts
import { access as access4, writeFile as writeFile3, mkdir as mkdir3 } from "fs/promises";
import { join as join8, dirname as dirname2 } from "path";
async function vizCommand(directory, options = {}) {
  const configPath = join8(directory, "roux.yaml");
  try {
    await access4(configPath);
  } catch {
    throw new Error(`Directory not initialized. Run 'roux init' first.`);
  }
  const cacheDir = join8(directory, ".roux");
  const outputPath = options.output ?? join8(cacheDir, "graph.html");
  const cache = new Cache(cacheDir);
  try {
    const nodes = cache.getAllNodes();
    const graphNodes = [];
    const graphEdges = [];
    const existingNodeIds = new Set(nodes.map((n) => n.id));
    for (const node of nodes) {
      const centrality = cache.getCentrality(node.id);
      graphNodes.push({
        id: node.id,
        title: node.title,
        inDegree: centrality?.inDegree ?? 0
      });
      for (const target of node.outgoingLinks) {
        if (existingNodeIds.has(target)) {
          graphEdges.push({
            source: node.id,
            target
          });
        }
      }
    }
    const html = generateHtml(graphNodes, graphEdges);
    await mkdir3(dirname2(outputPath), { recursive: true });
    await writeFile3(outputPath, html, "utf-8");
    return {
      outputPath,
      nodeCount: graphNodes.length,
      edgeCount: graphEdges.length,
      shouldOpen: options.open ?? false
    };
  } finally {
    cache.close();
  }
}
function generateHtml(nodes, edges) {
  const nodesJson = JSON.stringify(nodes);
  const edgesJson = JSON.stringify(edges);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Roux Graph Visualization</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #1a1a2e; overflow: hidden; }
    svg { display: block; width: 100vw; height: 100vh; }
    .node circle { cursor: pointer; }
    .node text { fill: #e0e0e0; font-size: 10px; pointer-events: none; }
    .link { stroke: #4a4a6a; stroke-opacity: 0.6; fill: none; }
    .tooltip {
      position: absolute;
      background: #16213e;
      color: #e0e0e0;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      border: 1px solid #4a4a6a;
    }
  </style>
</head>
<body>
  <div class="tooltip" id="tooltip"></div>
  <svg></svg>
  <script>
    const nodes = ${nodesJson};
    const links = ${edgesJson};

    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = d3.select("svg")
      .attr("viewBox", [0, 0, width, height]);

    const g = svg.append("g");

    // Zoom behavior
    svg.call(d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => g.attr("transform", event.transform)));

    // Node size based on in-degree
    const maxDegree = Math.max(1, ...nodes.map(n => n.inDegree));
    const nodeRadius = d => 5 + (d.inDegree / maxDegree) * 15;

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(d => nodeRadius(d) + 5));

    // Draw links with arrows
    svg.append("defs").append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#4a4a6a")
      .attr("d", "M0,-5L10,0L0,5");

    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", "link")
      .attr("marker-end", "url(#arrow)");

    // Draw nodes
    const node = g.append("g")
      .selectAll(".node")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    node.append("circle")
      .attr("r", nodeRadius)
      .attr("fill", "#0f4c75")
      .attr("stroke", "#3282b8")
      .attr("stroke-width", 2);

    node.append("text")
      .attr("dx", d => nodeRadius(d) + 5)
      .attr("dy", 4)
      .text(d => d.title.length > 20 ? d.title.slice(0, 17) + "..." : d.title);

    // HTML escape function for XSS prevention
    function escapeHtml(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Tooltip
    const tooltip = d3.select("#tooltip");
    node
      .on("mouseover", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(\`<strong>\${escapeHtml(d.title)}</strong><br>ID: \${escapeHtml(d.id)}<br>Incoming links: \${d.inDegree}\`);
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));

    // Simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node.attr("transform", d => \`translate(\${d.x},\${d.y})\`);
    });

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  </script>
</body>
</html>`;
}

// src/cli/index.ts
function handleCliError(error) {
  console.error(error instanceof Error ? error.message : "Unknown error");
  process.exit(1);
}
var program = new Command();
program.name("roux").description("Graph Programming Interface for knowledge bases").version(VERSION);
program.command("init").description("Initialize Roux in a directory").argument("[directory]", "Directory to initialize", ".").action(async (directory) => {
  const resolvedDir = resolve2(directory);
  const result = await initCommand(resolvedDir);
  if (result.created) {
    console.log(`Initialized Roux in ${resolvedDir}`);
    console.log(`  Config: ${result.configPath}`);
    if (result.hooksInstalled) {
      console.log(`  Claude hooks: installed`);
    }
  } else {
    if (result.hooksInstalled) {
      console.log(`Upgraded Roux in ${resolvedDir}`);
      console.log(`  Claude hooks: installed`);
    } else {
      console.log(`Already initialized: ${result.configPath}`);
    }
  }
});
program.command("status").description("Show graph statistics").argument("[directory]", "Directory to check", ".").action(async (directory) => {
  const resolvedDir = resolve2(directory);
  try {
    const result = await statusCommand(resolvedDir);
    console.log("Graph Status:");
    console.log(`  Nodes: ${result.nodeCount}`);
    console.log(`  Edges: ${result.edgeCount}`);
    console.log(`  Embeddings: ${result.embeddingCount}/${result.nodeCount}`);
    console.log(
      `  Coverage: ${(result.embeddingCoverage * 100).toFixed(1)}%`
    );
  } catch (error) {
    handleCliError(error);
  }
});
program.command("serve").description("Start MCP server with file watching").argument("[directory]", "Directory to serve", ".").option("--no-watch", "Disable file watching").action(async (directory, options) => {
  const resolvedDir = resolve2(directory);
  try {
    console.log("Starting Roux server...");
    const handle = await serveCommand(resolvedDir, {
      watch: options.watch,
      onProgress: (current, total) => {
        process.stdout.write(
          `\r[${current}/${total}] Generating embeddings...`
        );
        if (current === total) {
          console.log(" Done.");
        }
      }
    });
    console.log(`Serving ${handle.nodeCount} nodes`);
    if (handle.isWatching) {
      console.log("Watching for file changes...");
    }
    const shutdown = async () => {
      console.log("\nShutting down...");
      await handle.stop();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    await new Promise(() => {
    });
  } catch (error) {
    handleCliError(error);
  }
});
program.command("viz").description("Generate graph visualization").argument("[directory]", "Directory to visualize", ".").option("-o, --output <path>", "Output file path").option("--open", "Open in browser after generation").action(
  async (directory, options) => {
    const resolvedDir = resolve2(directory);
    try {
      const result = await vizCommand(resolvedDir, {
        output: options.output,
        open: options.open
      });
      console.log(
        `Generated visualization: ${result.nodeCount} nodes, ${result.edgeCount} edges`
      );
      console.log(`  Output: ${result.outputPath}`);
      if (result.shouldOpen) {
        const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        execFile(openCmd, [result.outputPath]);
      }
    } catch (error) {
      handleCliError(error);
    }
  }
);
program.parse();
//# sourceMappingURL=index.js.map