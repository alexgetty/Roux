import { describe, it, expect } from 'vitest';
import { cosineSimilarity, cosineDistance } from '../../../src/utils/math.js';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 10);
  });

  it('returns 1 for parallel vectors with different magnitudes', () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 10);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 10);
  });

  it('returns -1 for opposite vectors', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 10);
  });

  it('returns 0 when first vector is zero', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('returns 0 when second vector is zero', () => {
    const a = [1, 2, 3];
    const b = [0, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('returns 0 when both vectors are zero', () => {
    const a = [0, 0, 0];
    const b = [0, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('works with Float32Array', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });
});

describe('cosineDistance', () => {
  it('returns 0 for identical vectors', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(cosineDistance(a, b)).toBeCloseTo(0, 10);
  });

  it('returns 1 for orthogonal vectors', () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(cosineDistance(a, b)).toBeCloseTo(1, 10);
  });

  it('returns 2 for opposite vectors', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineDistance(a, b)).toBeCloseTo(2, 10);
  });

  it('returns 1 when first vector is zero', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineDistance(a, b)).toBe(1);
  });

  it('returns 1 when second vector is zero', () => {
    const a = [1, 2, 3];
    const b = [0, 0, 0];
    expect(cosineDistance(a, b)).toBe(1);
  });

  it('equals 1 - cosineSimilarity for non-zero vectors', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    const similarity = cosineSimilarity(a, b);
    const distance = cosineDistance(a, b);
    expect(distance).toBeCloseTo(1 - similarity, 10);
  });

  it('works with Float32Array', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([1, 2, 3]);
    expect(cosineDistance(a, b)).toBeCloseTo(0, 5);
  });
});
