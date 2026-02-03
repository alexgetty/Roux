import { describe, it, expect } from 'vitest';
import { isNode, isSourceRef, type Node, type SourceRef } from '../../../src/types/node.js';

describe('isNode', () => {
  const validNode: Node = {
    id: 'test/note.md',
    title: 'Test Note',
    content: 'Some content here',
    tags: ['test', 'example'],
    outgoingLinks: ['other/note.md'],
    properties: { custom: 'value' },
  };

  it('returns true for valid node', () => {
    expect(isNode(validNode)).toBe(true);
  });

  it('returns true for node with sourceRef', () => {
    const nodeWithRef: Node = {
      ...validNode,
      sourceRef: {
        type: 'file',
        path: '/path/to/file.md',
        lastModified: new Date(),
      },
    };
    expect(isNode(nodeWithRef)).toBe(true);
  });

  it('returns true for node with empty arrays', () => {
    const emptyNode: Node = {
      id: 'empty.md',
      title: 'Empty',
      content: '',
      tags: [],
      outgoingLinks: [],
      properties: {},
    };
    expect(isNode(emptyNode)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isNode(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isNode(undefined)).toBe(false);
  });

  it('returns false for primitive values', () => {
    expect(isNode('string')).toBe(false);
    expect(isNode(42)).toBe(false);
    expect(isNode(true)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isNode({})).toBe(false);
  });

  it('returns false when id is missing', () => {
    const { id: _, ...noId } = validNode;
    expect(isNode(noId)).toBe(false);
  });

  it('returns false when id is not a string', () => {
    expect(isNode({ ...validNode, id: 123 })).toBe(false);
  });

  it('returns false when title is missing', () => {
    const { title: _, ...noTitle } = validNode;
    expect(isNode(noTitle)).toBe(false);
  });

  it('returns false when title is not a string', () => {
    expect(isNode({ ...validNode, title: null })).toBe(false);
  });

  it('returns false when content is missing', () => {
    const { content: _, ...noContent } = validNode;
    expect(isNode(noContent)).toBe(false);
  });

  it('returns false when content is not a string', () => {
    expect(isNode({ ...validNode, content: [] })).toBe(false);
  });

  it('returns true for ghost node with content: null', () => {
    const ghostNode = { ...validNode, content: null };
    expect(isNode(ghostNode)).toBe(true);
  });

  it('returns false when content is undefined', () => {
    const { content: _, ...noContent } = validNode;
    expect(isNode({ ...noContent, content: undefined })).toBe(false);
  });

  it('returns false when tags is not an array', () => {
    expect(isNode({ ...validNode, tags: 'not-array' })).toBe(false);
  });

  it('returns false when tags contains non-strings', () => {
    expect(isNode({ ...validNode, tags: ['valid', 123] })).toBe(false);
  });

  it('returns false when outgoingLinks is not an array', () => {
    expect(isNode({ ...validNode, outgoingLinks: {} })).toBe(false);
  });

  it('returns false when outgoingLinks contains non-strings', () => {
    expect(isNode({ ...validNode, outgoingLinks: [null, 'valid'] })).toBe(false);
  });

  it('returns false when properties is not an object', () => {
    expect(isNode({ ...validNode, properties: 'not-object' })).toBe(false);
  });

  it('returns false when properties is null', () => {
    expect(isNode({ ...validNode, properties: null })).toBe(false);
  });

  it('returns false when properties is an array', () => {
    expect(isNode({ ...validNode, properties: ['not', 'an', 'object'] })).toBe(false);
  });

  it('returns false when sourceRef is present but invalid', () => {
    expect(isNode({ ...validNode, sourceRef: { type: 'invalid' } })).toBe(false);
    expect(isNode({ ...validNode, sourceRef: 'not-an-object' })).toBe(false);
    expect(isNode({ ...validNode, sourceRef: null })).toBe(false);
  });

  it('returns false when sourceRef has invalid lastModified', () => {
    expect(
      isNode({
        ...validNode,
        sourceRef: { type: 'file', lastModified: new Date('invalid') },
      })
    ).toBe(false);
  });
});

describe('isSourceRef', () => {
  it('returns true for valid file source ref', () => {
    const ref: SourceRef = {
      type: 'file',
      path: '/path/to/file.md',
      lastModified: new Date(),
    };
    expect(isSourceRef(ref)).toBe(true);
  });

  it('returns true for valid api source ref', () => {
    const ref: SourceRef = {
      type: 'api',
    };
    expect(isSourceRef(ref)).toBe(true);
  });

  it('returns true for valid manual source ref', () => {
    const ref: SourceRef = {
      type: 'manual',
    };
    expect(isSourceRef(ref)).toBe(true);
  });

  it('returns true for source ref with only path', () => {
    const ref: SourceRef = {
      type: 'file',
      path: '/some/path.md',
    };
    expect(isSourceRef(ref)).toBe(true);
  });

  it('returns true for source ref with only lastModified', () => {
    const ref: SourceRef = {
      type: 'file',
      lastModified: new Date(),
    };
    expect(isSourceRef(ref)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isSourceRef(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isSourceRef(undefined)).toBe(false);
  });

  it('returns false for primitive values', () => {
    expect(isSourceRef('file')).toBe(false);
    expect(isSourceRef(42)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isSourceRef({})).toBe(false);
  });

  it('returns false for invalid type value', () => {
    expect(isSourceRef({ type: 'invalid' })).toBe(false);
    expect(isSourceRef({ type: 123 })).toBe(false);
  });

  it('returns false when path is not a string', () => {
    expect(isSourceRef({ type: 'file', path: 123 })).toBe(false);
  });

  it('returns false when lastModified is not a Date', () => {
    expect(isSourceRef({ type: 'file', lastModified: '2024-01-01' })).toBe(false);
    expect(isSourceRef({ type: 'file', lastModified: 1234567890 })).toBe(false);
  });

  it('returns false when lastModified is an Invalid Date', () => {
    expect(isSourceRef({ type: 'file', lastModified: new Date('invalid') })).toBe(false);
    expect(isSourceRef({ type: 'file', lastModified: new Date(NaN) })).toBe(false);
  });
});
