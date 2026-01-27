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

// src/providers/docstore/cache/resolve.ts
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
import { join as join3 } from "path";

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
var SqliteVectorProvider = class {
  db;
  ownsDb;
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
  const vectorProvider = new SqliteVectorProvider(cacheDir);
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
import { writeFile as writeFile2, mkdir as mkdir2, rm } from "fs/promises";
import { join as join6, relative as relative2, dirname, extname as extname3 } from "path";

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

// src/graph/operations.ts
import { bidirectional } from "graphology-shortest-path";
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
  const scores = [];
  graph.forEachNode((id) => {
    let score;
    switch (metric) {
      case "in_degree":
        score = graph.inDegree(id);
        break;
      case "out_degree":
        score = graph.outDegree(id);
        break;
    }
    scores.push([id, score]);
  });
  scores.sort((a, b) => b[1] - a[1]);
  return scores.slice(0, limit);
}
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
function createDefaultRegistry() {
  const registry = new ReaderRegistry();
  registry.register(new MarkdownReader());
  return registry;
}

// src/providers/docstore/index.ts
var DocStore = class {
  cache;
  sourceRoot;
  graph = null;
  vectorProvider;
  ownsVectorProvider;
  registry;
  fileWatcher = null;
  onChangeCallback;
  constructor(sourceRoot, cacheDir, vectorProvider, registry) {
    this.sourceRoot = sourceRoot;
    this.cache = new Cache(cacheDir);
    this.ownsVectorProvider = !vectorProvider;
    this.vectorProvider = vectorProvider ?? new SqliteVectorProvider(cacheDir);
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
    this.rebuildGraph();
  }
  async createNode(node) {
    const normalizedId = normalizeId(node.id);
    validatePathWithinSource(this.sourceRoot, normalizedId);
    const existing = this.cache.getNode(normalizedId);
    if (existing) {
      throw new Error(`Node already exists: ${normalizedId}`);
    }
    const filePath = join6(this.sourceRoot, normalizedId);
    const dir = dirname(filePath);
    await mkdir2(dir, { recursive: true });
    const parsed = {
      title: node.title,
      tags: node.tags,
      properties: node.properties,
      content: node.content
    };
    const markdown = serializeToMarkdown(parsed);
    await writeFile2(filePath, markdown, "utf-8");
    const mtime = await getFileMtime(filePath);
    const normalizedNode = { ...node, id: normalizedId };
    this.cache.upsertNode(normalizedNode, "file", filePath, mtime);
    this.rebuildGraph();
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
    const filePath = join6(this.sourceRoot, existing.id);
    const parsed = {
      title: updated.title,
      tags: updated.tags,
      properties: updated.properties,
      content: updated.content
    };
    const markdown = serializeToMarkdown(parsed);
    await writeFile2(filePath, markdown, "utf-8");
    const mtime = await getFileMtime(filePath);
    this.cache.upsertNode(updated, "file", filePath, mtime);
    if (outgoingLinks !== void 0 || updates.outgoingLinks !== void 0) {
      this.rebuildGraph();
    }
  }
  async deleteNode(id) {
    const normalizedId = normalizeId(id);
    const existing = this.cache.getNode(normalizedId);
    if (!existing) {
      throw new Error(`Node not found: ${id}`);
    }
    const filePath = join6(this.sourceRoot, existing.id);
    await rm(filePath);
    this.cache.deleteNode(existing.id);
    await this.vectorProvider.delete(existing.id);
    this.rebuildGraph();
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
  async getRandomNode(tags) {
    let candidates;
    if (tags && tags.length > 0) {
      candidates = await this.searchByTags(tags, "any");
    } else {
      candidates = this.cache.getAllNodes();
    }
    if (candidates.length === 0) {
      return null;
    }
    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
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
  async getNeighbors(id, options) {
    this.ensureGraph();
    const neighborIds = getNeighborIds(this.graph, id, options);
    return this.cache.getNodes(neighborIds);
  }
  async findPath(source, target) {
    this.ensureGraph();
    return findPath(this.graph, source, target);
  }
  async getHubs(metric, limit) {
    this.ensureGraph();
    return getHubs(this.graph, metric, limit);
  }
  async storeEmbedding(id, vector, model) {
    return this.vectorProvider.store(id, vector, model);
  }
  async searchByVector(vector, limit) {
    return this.vectorProvider.search(vector, limit);
  }
  hasEmbedding(id) {
    return this.vectorProvider.hasEmbedding(id);
  }
  close() {
    this.stopWatching();
    this.cache.close();
    if (this.ownsVectorProvider && "close" in this.vectorProvider) {
      this.vectorProvider.close();
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
            await this.vectorProvider.delete(id);
            processedIds.push(id);
          }
        } else {
          const filePath = join6(this.sourceRoot, id);
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
      this.rebuildGraph();
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
  ensureGraph() {
    if (!this.graph) {
      this.rebuildGraph();
    }
  }
  rebuildGraph() {
    const nodes = this.cache.getAllNodes();
    this.graph = buildGraph(nodes);
    const centrality = computeCentrality(this.graph);
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
var TransformersEmbeddingProvider = class {
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
      throw new Error("StoreProvider not registered");
    }
    return this.store;
  }
  requireEmbedding() {
    if (!this.embedding) {
      throw new Error("EmbeddingProvider not registered");
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
        throw new Error("Semantic resolution requires EmbeddingProvider");
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
      throw new Error("StoreProvider configuration is required");
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
      const embedding = new TransformersEmbeddingProvider(model);
      core.registerEmbedding(embedding);
    } else {
      throw new Error(
        `Unsupported embedding provider type: ${embeddingConfig.type}. Supported: local`
      );
    }
    return core;
  }
};

// src/mcp/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

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
  const truncatedLength = Math.max(0, limit - TRUNCATION_SUFFIX.length);
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

// src/mcp/handlers.ts
function coerceLimit(value, defaultValue) {
  if (value === void 0 || value === null) {
    return defaultValue;
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return defaultValue;
  }
  const floored = Math.floor(num);
  if (floored < 1) {
    throw new McpError("INVALID_PARAMS", "limit must be at least 1");
  }
  return floored;
}
function coerceOffset(value, defaultValue) {
  if (value === void 0 || value === null) {
    return defaultValue;
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return defaultValue;
  }
  const floored = Math.floor(num);
  if (floored < 0) {
    throw new McpError("INVALID_PARAMS", "offset must be at least 0");
  }
  return floored;
}
async function handleSearch(ctx, args) {
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
async function handleGetNode(ctx, args) {
  const id = args.id;
  const depth = coerceDepth(args.depth);
  if (!id || typeof id !== "string") {
    throw new McpError("INVALID_PARAMS", "id is required and must be a string");
  }
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
var VALID_DIRECTIONS = ["in", "out", "both"];
async function handleGetNeighbors(ctx, args) {
  const id = args.id;
  const directionRaw = args.direction ?? "both";
  const limit = coerceLimit(args.limit, 20);
  const includeContent = args.include_content === true;
  if (!id || typeof id !== "string") {
    throw new McpError("INVALID_PARAMS", "id is required and must be a string");
  }
  if (!VALID_DIRECTIONS.includes(directionRaw)) {
    throw new McpError(
      "INVALID_PARAMS",
      `direction must be one of: ${VALID_DIRECTIONS.join(", ")}`
    );
  }
  const direction = directionRaw;
  const neighbors = await ctx.core.getNeighbors(id, { direction, limit });
  return nodesToResponses(neighbors, ctx.store, "list", includeContent);
}
async function handleFindPath(ctx, args) {
  const source = args.source;
  const target = args.target;
  if (!source || typeof source !== "string") {
    throw new McpError("INVALID_PARAMS", "source is required and must be a string");
  }
  if (!target || typeof target !== "string") {
    throw new McpError("INVALID_PARAMS", "target is required and must be a string");
  }
  const path = await ctx.core.findPath(source, target);
  if (!path) {
    return null;
  }
  return pathToResponse(path);
}
var VALID_METRICS = ["in_degree", "out_degree"];
async function handleGetHubs(ctx, args) {
  const metricRaw = args.metric ?? "in_degree";
  const limit = coerceLimit(args.limit, 10);
  if (!VALID_METRICS.includes(metricRaw)) {
    throw new McpError(
      "INVALID_PARAMS",
      `metric must be one of: ${VALID_METRICS.join(", ")}`
    );
  }
  const metric = metricRaw;
  const hubs = await ctx.core.getHubs(metric, limit);
  return hubsToResponses(hubs, ctx.store);
}
var VALID_TAG_MODES = ["any", "all"];
async function handleSearchByTags(ctx, args) {
  const tags = args.tags;
  const modeRaw = args.mode ?? "any";
  const limit = coerceLimit(args.limit, 20);
  if (!Array.isArray(tags) || tags.length === 0) {
    throw new McpError("INVALID_PARAMS", "tags is required and must be a non-empty array");
  }
  if (!tags.every((t) => typeof t === "string")) {
    throw new McpError("INVALID_PARAMS", "tags must contain only strings");
  }
  if (!VALID_TAG_MODES.includes(modeRaw)) {
    throw new McpError(
      "INVALID_PARAMS",
      `mode must be one of: ${VALID_TAG_MODES.join(", ")}`
    );
  }
  const mode = modeRaw;
  const nodes = await ctx.core.searchByTags(tags, mode, limit);
  return nodesToResponses(nodes, ctx.store, "list", true);
}
async function handleRandomNode(ctx, args) {
  const tags = args.tags;
  if (tags !== void 0) {
    if (!Array.isArray(tags) || !tags.every((t) => typeof t === "string")) {
      throw new McpError("INVALID_PARAMS", "tags must contain only strings");
    }
  }
  const node = await ctx.core.getRandomNode(tags);
  if (!node) {
    return null;
  }
  return nodeToResponse(node, ctx.store, "primary");
}
function deriveTitle(id) {
  const basename = id.split("/").pop() || "";
  const rawTitle = basename.replace(/\.md$/i, "");
  if (!rawTitle || !/[a-zA-Z0-9]/.test(rawTitle)) {
    return "Untitled";
  }
  return rawTitle;
}
async function handleCreateNode(ctx, args) {
  const idRaw = args.id;
  const titleRaw = args.title;
  const content = args.content;
  const tagsRaw = args.tags;
  if (!idRaw || typeof idRaw !== "string") {
    throw new McpError("INVALID_PARAMS", "id is required and must be a string");
  }
  if (!idRaw.toLowerCase().endsWith(".md")) {
    throw new McpError("INVALID_PARAMS", "id must end with .md extension");
  }
  if (content === void 0 || typeof content !== "string") {
    throw new McpError("INVALID_PARAMS", "content is required and must be a string");
  }
  let tags = [];
  if (tagsRaw !== void 0) {
    if (!Array.isArray(tagsRaw) || !tagsRaw.every((t) => typeof t === "string")) {
      throw new McpError("INVALID_PARAMS", "tags must contain only strings");
    }
    tags = tagsRaw;
  }
  const id = idRaw.toLowerCase();
  const title = titleRaw ?? deriveTitle(idRaw);
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
async function handleUpdateNode(ctx, args) {
  const id = args.id;
  const title = args.title;
  const content = args.content;
  const tagsRaw = args.tags;
  if (!id || typeof id !== "string") {
    throw new McpError("INVALID_PARAMS", "id is required and must be a string");
  }
  if (title === void 0 && content === void 0 && tagsRaw === void 0) {
    throw new McpError(
      "INVALID_PARAMS",
      "At least one of title, content, or tags must be provided"
    );
  }
  let tags;
  if (tagsRaw !== void 0) {
    if (!Array.isArray(tagsRaw) || !tagsRaw.every((t) => typeof t === "string")) {
      throw new McpError("INVALID_PARAMS", "tags must contain only strings");
    }
    tags = tagsRaw;
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
async function handleDeleteNode(ctx, args) {
  const id = args.id;
  if (!id || typeof id !== "string") {
    throw new McpError("INVALID_PARAMS", "id is required and must be a string");
  }
  const deleted = await ctx.core.deleteNode(id);
  return { deleted };
}
var VALID_STRATEGIES = ["exact", "fuzzy", "semantic"];
async function handleListNodes(ctx, args) {
  const tag = args.tag;
  const path = args.path;
  const limit = coerceLimit(args.limit, 100);
  const offset = coerceOffset(args.offset, 0);
  const filter = {};
  if (tag) filter.tag = tag;
  if (path) filter.path = path;
  return ctx.core.listNodes(filter, { limit, offset });
}
async function handleResolveNodes(ctx, args) {
  const names = args.names;
  const strategy = args.strategy;
  const threshold = args.threshold;
  const tag = args.tag;
  const path = args.path;
  if (!Array.isArray(names)) {
    throw new McpError("INVALID_PARAMS", "names is required and must be an array");
  }
  if (strategy !== void 0 && !VALID_STRATEGIES.includes(strategy)) {
    throw new McpError(
      "INVALID_PARAMS",
      `strategy must be one of: ${VALID_STRATEGIES.join(", ")}`
    );
  }
  if (strategy === "semantic" && !ctx.hasEmbedding) {
    throw new McpError("PROVIDER_ERROR", "Semantic resolution requires embedding provider");
  }
  const options = {};
  if (strategy) options.strategy = strategy;
  if (threshold !== void 0) options.threshold = threshold;
  if (tag) options.tag = tag;
  if (path) options.path = path;
  return ctx.core.resolveNodes(names, options);
}
async function handleNodesExist(ctx, args) {
  const ids = args.ids;
  if (!Array.isArray(ids)) {
    throw new McpError("INVALID_PARAMS", "ids is required and must be an array");
  }
  const result = await ctx.store.nodesExist(ids);
  const response = {};
  for (const [id, exists] of result) {
    response[id] = exists;
  }
  return response;
}
async function dispatchTool(ctx, name, args) {
  switch (name) {
    case "search":
      return handleSearch(ctx, args);
    case "get_node":
      return handleGetNode(ctx, args);
    case "get_neighbors":
      return handleGetNeighbors(ctx, args);
    case "find_path":
      return handleFindPath(ctx, args);
    case "get_hubs":
      return handleGetHubs(ctx, args);
    case "search_by_tags":
      return handleSearchByTags(ctx, args);
    case "random_node":
      return handleRandomNode(ctx, args);
    case "create_node":
      return handleCreateNode(ctx, args);
    case "update_node":
      return handleUpdateNode(ctx, args);
    case "delete_node":
      return handleDeleteNode(ctx, args);
    case "list_nodes":
      return handleListNodes(ctx, args);
    case "resolve_nodes":
      return handleResolveNodes(ctx, args);
    case "nodes_exist":
      return handleNodesExist(ctx, args);
    default:
      throw new McpError("INVALID_PARAMS", `Unknown tool: ${name}`);
  }
}

// src/mcp/server.ts
var TOOL_SCHEMAS = {
  search: {
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
  },
  get_node: {
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
  },
  get_neighbors: {
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
  },
  find_path: {
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
  },
  get_hubs: {
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
  },
  search_by_tags: {
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
      }
    },
    required: ["tags"]
  },
  random_node: {
    type: "object",
    properties: {
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Optional: limit to nodes with these tags (any match)"
      }
    }
  },
  create_node: {
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
  },
  update_node: {
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
  },
  delete_node: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: 'Node ID to delete. ID is normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").'
      }
    },
    required: ["id"]
  },
  list_nodes: {
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
  },
  resolve_nodes: {
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
  },
  nodes_exist: {
    type: "object",
    properties: {
      ids: {
        type: "array",
        items: { type: "string" },
        description: 'Node IDs to check existence. IDs are normalized to lowercase (e.g., "Recipes/Bulgogi.md" becomes "recipes/bulgogi.md").'
      }
    },
    required: ["ids"]
  }
};
function getToolDefinitions(hasEmbedding) {
  const tools = [
    {
      name: "get_node",
      description: "Retrieve a single node by ID with optional neighbor context",
      inputSchema: TOOL_SCHEMAS.get_node
    },
    {
      name: "get_neighbors",
      description: "Get nodes linked to or from a specific node",
      inputSchema: TOOL_SCHEMAS.get_neighbors
    },
    {
      name: "find_path",
      description: "Find the shortest path between two nodes",
      inputSchema: TOOL_SCHEMAS.find_path
    },
    {
      name: "get_hubs",
      description: "Get the most central nodes by graph metric",
      inputSchema: TOOL_SCHEMAS.get_hubs
    },
    {
      name: "search_by_tags",
      description: "Filter nodes by tags (AND or OR matching)",
      inputSchema: TOOL_SCHEMAS.search_by_tags
    },
    {
      name: "random_node",
      description: "Get a random node for discovery, optionally filtered by tags",
      inputSchema: TOOL_SCHEMAS.random_node
    },
    {
      name: "create_node",
      description: "Create a new node (writes file for DocStore)",
      inputSchema: TOOL_SCHEMAS.create_node
    },
    {
      name: "update_node",
      description: "Update an existing node. Title changes rejected if incoming links exist.",
      inputSchema: TOOL_SCHEMAS.update_node
    },
    {
      name: "delete_node",
      description: "Delete a node by ID",
      inputSchema: TOOL_SCHEMAS.delete_node
    },
    {
      name: "list_nodes",
      description: 'List nodes with optional filters and pagination. Tag filter searches the "tags" frontmatter array only. All IDs returned are lowercase.',
      inputSchema: TOOL_SCHEMAS.list_nodes
    },
    {
      name: "resolve_nodes",
      description: 'Batch resolve names to existing node IDs. Strategy selection: "exact" for known titles, "fuzzy" for typos/misspellings (e.g., "chikken" -> "chicken"), "semantic" for synonyms/concepts (e.g., "poultry leg meat" -> "chicken thigh"). Semantic does NOT handle typos \u2014 misspellings produce garbage embeddings.',
      inputSchema: TOOL_SCHEMAS.resolve_nodes
    },
    {
      name: "nodes_exist",
      description: "Batch check if node IDs exist. IDs are normalized to lowercase before checking.",
      inputSchema: TOOL_SCHEMAS.nodes_exist
    }
  ];
  if (hasEmbedding) {
    tools.unshift({
      name: "search",
      description: "Semantic similarity search across all nodes",
      inputSchema: TOOL_SCHEMAS.search
    });
  }
  return tools;
}
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
      hasEmbedding: options.hasEmbedding
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
  const store = new DocStore(resolvedSourcePath, resolvedCachePath);
  const embedding = new TransformersEmbeddingProvider(
    config.providers?.embedding?.type === "local" ? config.providers.embedding.model : void 0
  );
  await store.sync();
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
  const core = new GraphCoreImpl();
  core.registerStore(store);
  core.registerEmbedding(embedding);
  const mcpServer = new McpServer({
    core,
    store,
    hasEmbedding: true
  });
  await mcpServer.start(transportFactory);
  if (watch2) {
    try {
      await store.startWatching(async (changedIds) => {
        for (const id of changedIds) {
          const node = await store.getNode(id);
          if (node && node.content) {
            const vector = await embedding.embed(node.content);
            await store.storeEmbedding(id, vector, embedding.modelId());
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
      store.stopWatching();
      store.close();
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

    // Tooltip
    const tooltip = d3.select("#tooltip");
    node
      .on("mouseover", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(\`<strong>\${d.title}</strong><br>ID: \${d.id}<br>Incoming links: \${d.inDegree}\`);
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
    console.error(
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
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
    console.error(
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
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
      console.error(
        error instanceof Error ? error.message : "Unknown error"
      );
      process.exit(1);
    }
  }
);
program.parse();
//# sourceMappingURL=index.js.map