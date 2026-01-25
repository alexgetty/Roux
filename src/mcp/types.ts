import type { LinkInfo } from '../types/provider.js';

/** Link with resolved human-readable title. Re-export for MCP layer. */
export type { LinkInfo };

/** Subset of Node fields optimized for LLM consumption. */
export interface NodeResponse {
  id: string;
  title: string;
  content: string;
  tags: string[];
  links: LinkInfo[];
  properties: Record<string, unknown>;
}

/** Extended response for get_node with depth > 0. */
export interface NodeWithContextResponse extends NodeResponse {
  incomingNeighbors: NodeResponse[];
  outgoingNeighbors: NodeResponse[];
  incomingCount: number;
  outgoingCount: number;
}

/** Search results include similarity score. */
export interface SearchResultResponse extends NodeResponse {
  score: number;
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
