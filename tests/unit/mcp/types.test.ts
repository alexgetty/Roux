import { describe, it, expect } from 'vitest';
import { McpError } from '../../../src/mcp/types.js';
import type {
  NodeResponse,
  NodeWithContextResponse,
  SearchResultResponse,
  HubResponse,
  PathResponse,
  DeleteResponse,
  ErrorResponse,
  ErrorCode,
} from '../../../src/mcp/types.js';

describe('McpError', () => {
  it('creates error with code and message', () => {
    const error = new McpError('NODE_NOT_FOUND', 'Node xyz not found');

    expect(error.code).toBe('NODE_NOT_FOUND');
    expect(error.message).toBe('Node xyz not found');
    expect(error.name).toBe('McpError');
  });

  it('converts to ErrorResponse', () => {
    const error = new McpError('INVALID_PARAMS', 'Missing required field');
    const response = error.toResponse();

    expect(response).toEqual({
      error: {
        code: 'INVALID_PARAMS',
        message: 'Missing required field',
      },
    });
  });

  it('is instanceof Error', () => {
    const error = new McpError('PROVIDER_ERROR', 'Database error');
    expect(error instanceof Error).toBe(true);
  });

  describe('error codes', () => {
    const testCases: Array<{ code: ErrorCode; scenario: string }> = [
      { code: 'INVALID_PARAMS', scenario: 'schema validation failed' },
      { code: 'NODE_EXISTS', scenario: 'create_node on existing node' },
      { code: 'NODE_NOT_FOUND', scenario: 'update_node on missing node' },
      { code: 'LINK_INTEGRITY', scenario: 'title change would break links' },
      { code: 'PROVIDER_ERROR', scenario: 'provider operation failed' },
    ];

    for (const { code, scenario } of testCases) {
      it(`supports ${code} for ${scenario}`, () => {
        const error = new McpError(code, scenario);
        expect(error.code).toBe(code);
      });
    }
  });
});

describe('response type shapes', () => {
  it('NodeResponse has expected structure', () => {
    const response: NodeResponse = {
      id: 'test.md',
      title: 'Test',
      content: 'Content',
      tags: ['tag1'],
      links: [{ id: 'other.md', title: 'Other' }],
    };

    expect(response.id).toBe('test.md');
    expect(response.title).toBe('Test');
    expect(response.content).toBe('Content');
    expect(response.tags).toEqual(['tag1']);
    expect(response.links).toHaveLength(1);
    expect(response.links[0]).toEqual({ id: 'other.md', title: 'Other' });
  });

  it('NodeWithContextResponse extends NodeResponse', () => {
    const response: NodeWithContextResponse = {
      id: 'test.md',
      title: 'Test',
      content: 'Content',
      tags: [],
      links: [],
      incomingNeighbors: [],
      outgoingNeighbors: [],
      incomingCount: 5,
      outgoingCount: 3,
    };

    expect(response.incomingNeighbors).toEqual([]);
    expect(response.outgoingNeighbors).toEqual([]);
    expect(response.incomingCount).toBe(5);
    expect(response.outgoingCount).toBe(3);
  });

  it('SearchResultResponse extends NodeResponse with score', () => {
    const response: SearchResultResponse = {
      id: 'test.md',
      title: 'Test',
      content: 'Content',
      tags: [],
      links: [],
      score: 0.89,
    };

    expect(response.score).toBe(0.89);
  });

  it('HubResponse has id, title, and score', () => {
    const response: HubResponse = {
      id: 'hub.md',
      title: 'Hub Node',
      score: 45,
    };

    expect(response.id).toBe('hub.md');
    expect(response.title).toBe('Hub Node');
    expect(response.score).toBe(45);
  });

  it('PathResponse has path array and length', () => {
    const response: PathResponse = {
      path: ['a.md', 'b.md', 'c.md'],
      length: 2,
    };

    expect(response.path).toEqual(['a.md', 'b.md', 'c.md']);
    expect(response.length).toBe(2);
  });

  it('DeleteResponse has deleted boolean', () => {
    const success: DeleteResponse = { deleted: true };
    const failure: DeleteResponse = { deleted: false };

    expect(success.deleted).toBe(true);
    expect(failure.deleted).toBe(false);
  });

  it('ErrorResponse has error object with code and message', () => {
    const response: ErrorResponse = {
      error: {
        code: 'NODE_NOT_FOUND',
        message: 'Node xyz not found',
      },
    };

    expect(response.error.code).toBe('NODE_NOT_FOUND');
    expect(response.error.message).toBe('Node xyz not found');
  });
});
