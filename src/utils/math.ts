type VectorLike = ArrayLike<number>;

/**
 * Compute cosine similarity between two vectors.
 * Returns value in range [-1, 1] where 1 = identical direction, 0 = orthogonal, -1 = opposite.
 * Returns 0 if either vector has zero magnitude.
 * Throws if either vector is empty or dimensions differ.
 */
export function cosineSimilarity(a: VectorLike, b: VectorLike): number {
  if (a.length === 0 || b.length === 0) {
    throw new Error('Cannot compute similarity for empty vector');
  }
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Compute cosine distance between two vectors.
 * Returns value in range [0, 2] where 0 = identical direction, 1 = orthogonal, 2 = opposite.
 * Returns 1 if either vector has zero magnitude.
 */
export function cosineDistance(a: VectorLike, b: VectorLike): number {
  const similarity = cosineSimilarity(a, b);
  if (similarity === 0 && (isZeroVector(a) || isZeroVector(b))) {
    return 1;
  }
  return 1 - similarity;
}

function isZeroVector(v: VectorLike): boolean {
  for (let i = 0; i < v.length; i++) {
    if (v[i] !== 0) return false;
  }
  return true;
}
