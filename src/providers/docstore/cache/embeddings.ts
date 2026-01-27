import type Database from 'better-sqlite3';

export interface EmbeddingRecord {
  model: string;
  vector: number[];
}

interface EmbeddingRow {
  node_id: string;
  model: string;
  vector: Buffer;
}

export function storeEmbedding(
  db: Database.Database,
  nodeId: string,
  vector: number[],
  model: string
): void {
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

export function getEmbedding(
  db: Database.Database,
  nodeId: string
): EmbeddingRecord | null {
  const row = db
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
