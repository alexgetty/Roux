import { describe, it, expect } from 'vitest';
import { resolveNames, type Candidate } from '../../../../src/providers/docstore/cache/resolve.js';

describe('resolveNames', () => {
  const candidates: Candidate[] = [
    { id: 'ingredients/ground beef.md', title: 'Ground Beef' },
    { id: 'ingredients/cheddar cheese.md', title: 'Cheddar Cheese' },
    { id: 'recipes/beef tacos.md', title: 'Beef Tacos' },
  ];

  describe('empty input', () => {
    it('returns empty array for empty names', () => {
      const result = resolveNames([], candidates, { strategy: 'fuzzy', threshold: 0.7 });
      expect(result).toEqual([]);
    });

    it('returns no-match results when candidates empty', () => {
      const result = resolveNames(['something'], [], { strategy: 'fuzzy', threshold: 0.7 });
      expect(result).toHaveLength(1);
      expect(result[0]!.query).toBe('something');
      expect(result[0]!.match).toBeNull();
      expect(result[0]!.score).toBe(0);
    });
  });

  describe('exact strategy', () => {
    it('matches case-insensitively on title', () => {
      const result = resolveNames(['ground beef'], candidates, { strategy: 'exact', threshold: 0.7 });

      expect(result).toHaveLength(1);
      expect(result[0]!.query).toBe('ground beef');
      expect(result[0]!.match).toBe('ingredients/ground beef.md');
      expect(result[0]!.score).toBe(1);
    });

    it('matches with different casing', () => {
      const result = resolveNames(['GROUND BEEF'], candidates, { strategy: 'exact', threshold: 0.7 });

      expect(result[0]!.match).toBe('ingredients/ground beef.md');
      expect(result[0]!.score).toBe(1);
    });

    it('returns null match when not found', () => {
      const result = resolveNames(['unknown item'], candidates, { strategy: 'exact', threshold: 0.7 });

      expect(result[0]!.query).toBe('unknown item');
      expect(result[0]!.match).toBeNull();
      expect(result[0]!.score).toBe(0);
    });

    it('ignores threshold for exact strategy', () => {
      const result = resolveNames(['ground beef'], candidates, { strategy: 'exact', threshold: 0.99 });

      expect(result[0]!.match).toBe('ingredients/ground beef.md');
      expect(result[0]!.score).toBe(1);
    });
  });

  describe('fuzzy strategy', () => {
    it('finds best fuzzy match', () => {
      const result = resolveNames(['ground bef'], candidates, { strategy: 'fuzzy', threshold: 0.7 });

      expect(result[0]!.match).toBe('ingredients/ground beef.md');
      expect(result[0]!.score).toBeGreaterThan(0.7);
    });

    it('respects threshold - rejects low scores', () => {
      const result = resolveNames(['xyz'], candidates, { strategy: 'fuzzy', threshold: 0.9 });

      expect(result[0]!.match).toBeNull();
      expect(result[0]!.score).toBe(0);
    });

    describe('threshold boundary', () => {
      it('includes match when score exactly equals threshold (>= semantics)', () => {
        // Find actual score for a query to set threshold at exact boundary
        const probeResult = resolveNames(['ground bef'], candidates, { strategy: 'fuzzy', threshold: 0 });
        const exactScore = probeResult[0]!.score;

        // Now set threshold to exactly that score - should still match
        const result = resolveNames(['ground bef'], candidates, { strategy: 'fuzzy', threshold: exactScore });

        expect(result[0]!.match).toBe('ingredients/ground beef.md');
        expect(result[0]!.score).toBe(exactScore);
      });

      it('excludes match when score just below threshold', () => {
        // Find actual score and set threshold slightly above
        const probeResult = resolveNames(['ground bef'], candidates, { strategy: 'fuzzy', threshold: 0 });
        const exactScore = probeResult[0]!.score;
        const thresholdAbove = exactScore + 0.001;

        const result = resolveNames(['ground bef'], candidates, { strategy: 'fuzzy', threshold: thresholdAbove });

        expect(result[0]!.match).toBeNull();
        expect(result[0]!.score).toBe(0);
      });

      it('handles threshold of 0 (matches anything with score >= 0)', () => {
        // Threshold 0 accepts all matches including score 0
        // 'xyz' has no character overlap with candidates, score is 0
        const zeroScoreResult = resolveNames(['xyz'], candidates, { strategy: 'fuzzy', threshold: 0 });
        expect(zeroScoreResult[0]!.match).not.toBeNull();
        expect(zeroScoreResult[0]!.score).toBe(0);

        // Any partial match returns positive score
        const partialResult = resolveNames(['beef'], candidates, { strategy: 'fuzzy', threshold: 0 });
        expect(partialResult[0]!.match).not.toBeNull();
        expect(partialResult[0]!.score).toBeGreaterThan(0);
      });

      it('handles threshold of 1 (exact matches only)', () => {
        // Exact match should work
        const exactResult = resolveNames(['ground beef'], candidates, { strategy: 'fuzzy', threshold: 1 });
        expect(exactResult[0]!.match).toBe('ingredients/ground beef.md');

        // Near match should fail
        const nearResult = resolveNames(['ground bef'], candidates, { strategy: 'fuzzy', threshold: 1 });
        expect(nearResult[0]!.match).toBeNull();
      });
    });

    it('matches with typos above threshold', () => {
      const result = resolveNames(['ground beeef'], candidates, { strategy: 'fuzzy', threshold: 0.7 });

      expect(result[0]!.match).not.toBeNull();
    });

    it('returns score from string-similarity', () => {
      const result = resolveNames(['ground beef'], candidates, { strategy: 'fuzzy', threshold: 0.7 });

      // Exact match should have very high score
      expect(result[0]!.score).toBeGreaterThan(0.9);
    });
  });

  describe('semantic strategy', () => {
    it('returns no match (not supported at this level)', () => {
      const result = resolveNames(['ground beef'], candidates, { strategy: 'semantic', threshold: 0.7 });

      expect(result[0]!.match).toBeNull();
      expect(result[0]!.score).toBe(0);
    });
  });

  describe('batch behavior', () => {
    it('preserves order of input queries', () => {
      const result = resolveNames(
        ['cheddar cheese', 'ground beef'],
        candidates,
        { strategy: 'exact', threshold: 0.7 }
      );

      expect(result[0]!.query).toBe('cheddar cheese');
      expect(result[1]!.query).toBe('ground beef');
    });

    it('handles mixed matches and non-matches', () => {
      const result = resolveNames(
        ['ground beef', 'unknown', 'cheddar cheese'],
        candidates,
        { strategy: 'exact', threshold: 0.7 }
      );

      expect(result).toHaveLength(3);
      expect(result[0]!.match).not.toBeNull();
      expect(result[1]!.match).toBeNull();
      expect(result[2]!.match).not.toBeNull();
    });
  });
});
