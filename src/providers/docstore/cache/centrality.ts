import type Database from 'better-sqlite3';

export interface CentralityRecord {
  pagerank: number;
  inDegree: number;
  outDegree: number;
  computedAt: number;
}

interface CentralityRow {
  node_id: string;
  pagerank: number;
  in_degree: number;
  out_degree: number;
  computed_at: number;
}

export function storeCentrality(
  db: Database.Database,
  nodeId: string,
  pagerank: number,
  inDegree: number,
  outDegree: number,
  computedAt: number
): void {
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

export function getCentrality(
  db: Database.Database,
  nodeId: string
): CentralityRecord | null {
  const row = db
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
