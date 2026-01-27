import type { LinkInfo } from '../types/provider.js';

/** Metadata-only response for browsing operations (search, get_neighbors). */
export interface NodeMetadataResponse {
  id: string;
  title: string;
  tags: string[];
  links: LinkInfo[];
  properties: Record<string, unknown>;
}

/** Full response including content (for get_node, create, update, etc.). */
export interface NodeResponse extends NodeMetadataResponse {
  content: string;
}

/** Extended response for get_node with depth > 0. */
export interface NodeWithContextResponse extends NodeResponse {
  incomingNeighbors: NodeResponse[];
  outgoingNeighbors: NodeResponse[];
  incomingCount: number;
  outgoingCount: number;
}

/** Search results include similarity score. Content optional based on include_content param. */
export interface SearchResultResponse extends NodeMetadataResponse {
  score: number;
  content?: string;
}

/** Hub results pair ID with metric value. */
export interface HubResponse {
  id: string;
  title: string;
  score: number;
}

/** Path results are ordered node IDs. */
export interface PathResponse {
  path: string[];
  length: number;
}

/** Delete operation result. */
export interface DeleteResponse {
  deleted: boolean;
}

/** Standard error response shape. */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
  };
}

/** Known error codes. */
export type ErrorCode =
  | 'INVALID_PARAMS'
  | 'NODE_EXISTS'
  | 'NODE_NOT_FOUND'
  | 'LINK_INTEGRITY'
  | 'PROVIDER_ERROR';

/** Custom error class for MCP operations. */
export class McpError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'McpError';
  }

  toResponse(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }
}
