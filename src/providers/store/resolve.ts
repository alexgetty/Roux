import stringSimilarity from 'string-similarity';
import type { ResolveResult, ResolveStrategy } from '../../types/provider.js';

export interface Candidate {
  id: string;
  title: string;
}

export interface ResolveMatchOptions {
  strategy: ResolveStrategy;
  threshold: number;
}

/**
 * Resolve names to node IDs using exact or fuzzy matching.
 * Semantic strategy returns no matches (handled at higher level with embeddings).
 */
export function resolveNames(
  names: string[],
  candidates: Candidate[],
  options: ResolveMatchOptions
): ResolveResult[] {
  if (names.length === 0) return [];

  const { strategy, threshold } = options;

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
      const matchedId = titleToId.get(queryLower);
      if (matchedId) {
        return { query, match: matchedId, score: 1 };
      }
      return { query, match: null, score: 0 };
    }

    if (strategy === 'fuzzy') {
      const result = stringSimilarity.findBestMatch(queryLower, candidateTitles);
      const bestMatch = result.bestMatch;

      if (bestMatch.rating >= threshold) {
        const matchedId = titleToId.get(bestMatch.target)!;
        return { query, match: matchedId, score: bestMatch.rating };
      }
      return { query, match: null, score: 0 };
    }

    // Semantic strategy - not supported at this level
    return { query, match: null, score: 0 };
  });
}
