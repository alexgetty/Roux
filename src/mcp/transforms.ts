import type { Node } from '../types/node.js';
import type { LinkInfo, StoreProvider } from '../types/provider.js';
import type {
  NodeResponse,
  NodeMetadataResponse,
  NodeWithContextResponse,
  SearchResultResponse,
  HubResponse,
  PathResponse,
} from './types.js';
import { truncateContent, type TruncationContext } from './truncate.js';

/** Maximum neighbors to include in NodeWithContextResponse. */
export const MAX_NEIGHBORS = 20;

/** Maximum links to resolve titles for (prevents OOM on nodes with massive link counts). */
export const MAX_LINKS_TO_RESOLVE = 100;

/**
 * Transform a Node to NodeResponse, resolving link titles.
 */
export async function nodeToResponse(
  node: Node,
  store: StoreProvider,
  truncation: TruncationContext
): Promise<NodeResponse> {
  // Limit links to prevent OOM on nodes with massive outgoing link counts
  const linksToResolve = node.outgoingLinks.slice(0, MAX_LINKS_TO_RESOLVE);
  const titles = await store.resolveTitles(linksToResolve);

  const links: LinkInfo[] = linksToResolve.map((id) => ({
    id,
    title: titles.get(id) ?? id,
  }));

  return {
    id: node.id,
    title: node.title,
    content: truncateContent(node.content, truncation),
    tags: node.tags,
    links,
    properties: node.properties,
  };
}

/**
 * Transform multiple nodes to responses, resolving all link titles in batch.
 * When includeContent is false, returns NodeMetadataResponse[] (no content field).
 * When includeContent is true, returns NodeResponse[] (with truncated content).
 */
export async function nodesToResponses(
  nodes: Node[],
  store: StoreProvider,
  truncation: TruncationContext,
  includeContent: boolean
): Promise<NodeResponse[] | NodeMetadataResponse[]> {
  // Collect unique link IDs, limiting per-node to prevent OOM
  const allLinkIds = new Set<string>();
  const nodeLinkLimits = new Map<string, string[]>();

  for (const node of nodes) {
    const limitedLinks = node.outgoingLinks.slice(0, MAX_LINKS_TO_RESOLVE);
    nodeLinkLimits.set(node.id, limitedLinks);
    for (const linkId of limitedLinks) {
      allLinkIds.add(linkId);
    }
  }

  // Batch resolve titles
  const titles = await store.resolveTitles(Array.from(allLinkIds));

  // Transform nodes using limited links
  return nodes.map((node) => {
    // Defensive fallback - all node IDs are populated in the loop above
    const limitedLinks = nodeLinkLimits.get(node.id) /* v8 ignore next */ ?? [];
    const base: NodeMetadataResponse = {
      id: node.id,
      title: node.title,
      tags: node.tags,
      links: limitedLinks.map((id) => ({
        id,
        title: titles.get(id) ?? id,
      })),
      properties: node.properties,
    };

    if (includeContent) {
      return {
        ...base,
        content: truncateContent(node.content, truncation),
      } as NodeResponse;
    }

    return base;
  });
}

/**
 * Transform a Node with neighbor context to NodeWithContextResponse.
 */
export async function nodeToContextResponse(
  node: Node,
  incomingNeighbors: Node[],
  outgoingNeighbors: Node[],
  store: StoreProvider
): Promise<NodeWithContextResponse> {
  // Get primary node response
  const primary = await nodeToResponse(node, store, 'primary');

  // Limit neighbors
  const limitedIncoming = incomingNeighbors.slice(0, MAX_NEIGHBORS);
  const limitedOutgoing = outgoingNeighbors.slice(0, MAX_NEIGHBORS);

  // Transform neighbors with neighbor truncation
  // Context responses always include content (truncated for neighbors)
  const [incomingResponses, outgoingResponses] = await Promise.all([
    nodesToResponses(limitedIncoming, store, 'neighbor', true) as Promise<NodeResponse[]>,
    nodesToResponses(limitedOutgoing, store, 'neighbor', true) as Promise<NodeResponse[]>,
  ]);

  return {
    ...primary,
    incomingNeighbors: incomingResponses,
    outgoingNeighbors: outgoingResponses,
    incomingCount: incomingNeighbors.length,
    outgoingCount: outgoingNeighbors.length,
  };
}

/**
 * Transform search results with scores.
 * When includeContent is false, content field is omitted.
 * When includeContent is true, content is truncated and included.
 */
export async function nodesToSearchResults(
  nodes: Node[],
  scores: Map<string, number>,
  store: StoreProvider,
  includeContent: boolean
): Promise<SearchResultResponse[]> {
  const responses = await nodesToResponses(nodes, store, 'list', includeContent);

  return responses.map((response) => ({
    ...response,
    score: scores.get(response.id) ?? 0,
  }));
}

/**
 * Transform hub results (id, score pairs) to HubResponse[].
 */
export async function hubsToResponses(
  hubs: Array<[string, number]>,
  store: StoreProvider
): Promise<HubResponse[]> {
  const ids = hubs.map(([id]) => id);
  const titles = await store.resolveTitles(ids);

  return hubs.map(([id, score]) => ({
    id,
    title: titles.get(id) ?? id,
    score,
  }));
}

/**
 * Transform a path (array of node IDs) to PathResponse.
 */
export function pathToResponse(path: string[]): PathResponse {
  return {
    path,
    length: path.length - 1,
  };
}
