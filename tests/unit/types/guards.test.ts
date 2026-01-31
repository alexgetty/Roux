import { describe, it, expect } from 'vitest';
import { createGuard, type PropertySchema, type Schema } from '../../../src/types/guards.js';

describe('createGuard', () => {
  it('returns a function', () => {
    const guard = createGuard({});
    expect(typeof guard).toBe('function');
  });

  describe('null/undefined checks', () => {
    const guard = createGuard({ name: { type: 'string' } });

    it('returns false for null', () => {
      expect(guard(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(guard(undefined)).toBe(false);
    });

    it('returns false for primitive values', () => {
      expect(guard('string')).toBe(false);
      expect(guard(42)).toBe(false);
      expect(guard(true)).toBe(false);
    });
  });

  describe('required string properties', () => {
    const guard = createGuard<{ name: string }>({
      name: { type: 'string' },
    });

    it('returns true when string property exists', () => {
      expect(guard({ name: 'test' })).toBe(true);
    });

    it('returns true for empty string when nonEmpty not specified', () => {
      expect(guard({ name: '' })).toBe(true);
    });

    it('returns false when string property is missing', () => {
      expect(guard({})).toBe(false);
    });

    it('returns false when string property has wrong type', () => {
      expect(guard({ name: 123 })).toBe(false);
      expect(guard({ name: null })).toBe(false);
      expect(guard({ name: undefined })).toBe(false);
    });
  });

  describe('optional properties', () => {
    const guard = createGuard<{ id: string; age?: number }>({
      id: { type: 'string' },
      age: { type: 'number', optional: true },
    });

    it('returns true when optional property is missing', () => {
      expect(guard({ id: 'test' })).toBe(true);
    });

    it('returns true when optional property is undefined', () => {
      expect(guard({ id: 'test', age: undefined })).toBe(true);
    });

    it('returns true when optional property has correct type', () => {
      expect(guard({ id: 'test', age: 25 })).toBe(true);
    });

    it('returns false when optional property has wrong type', () => {
      expect(guard({ id: 'test', age: 'twenty-five' })).toBe(false);
    });
  });

  describe('nonEmpty string validation', () => {
    const guard = createGuard<{ id: string }>({
      id: { type: 'string', nonEmpty: true },
    });

    it('returns true for non-empty string', () => {
      expect(guard({ id: 'test' })).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(guard({ id: '' })).toBe(false);
    });

    it('returns false for non-string values', () => {
      expect(guard({ id: 123 })).toBe(false);
    });
  });

  describe('function properties', () => {
    const guard = createGuard<{ callback: () => void }>({
      callback: { type: 'function' },
    });

    it('returns true when property is a function', () => {
      expect(guard({ callback: () => {} })).toBe(true);
      expect(guard({ callback: function () {} })).toBe(true);
      expect(guard({ callback: async () => {} })).toBe(true);
    });

    it('returns false when property is not a function', () => {
      expect(guard({ callback: 'not-a-function' })).toBe(false);
      expect(guard({ callback: {} })).toBe(false);
      expect(guard({ callback: null })).toBe(false);
    });
  });

  describe('array properties', () => {
    const guard = createGuard<{ items: unknown[] }>({
      items: { type: 'array' },
    });

    it('returns true when property is an array', () => {
      expect(guard({ items: [] })).toBe(true);
      expect(guard({ items: [1, 2, 3] })).toBe(true);
      expect(guard({ items: ['a', 'b'] })).toBe(true);
    });

    it('returns false when property is not an array', () => {
      expect(guard({ items: {} })).toBe(false);
      expect(guard({ items: 'not-array' })).toBe(false);
      expect(guard({ items: null })).toBe(false);
    });
  });

  describe('number properties', () => {
    const guard = createGuard<{ count: number }>({
      count: { type: 'number' },
    });

    it('returns true when property is a number', () => {
      expect(guard({ count: 0 })).toBe(true);
      expect(guard({ count: 42 })).toBe(true);
      expect(guard({ count: -1 })).toBe(true);
      expect(guard({ count: 3.14 })).toBe(true);
    });

    it('returns false when property is not a number', () => {
      expect(guard({ count: '42' })).toBe(false);
      expect(guard({ count: null })).toBe(false);
    });
  });

  describe('boolean properties', () => {
    const guard = createGuard<{ enabled: boolean }>({
      enabled: { type: 'boolean' },
    });

    it('returns true when property is a boolean', () => {
      expect(guard({ enabled: true })).toBe(true);
      expect(guard({ enabled: false })).toBe(true);
    });

    it('returns false when property is not a boolean', () => {
      expect(guard({ enabled: 'true' })).toBe(false);
      expect(guard({ enabled: 1 })).toBe(false);
      expect(guard({ enabled: null })).toBe(false);
    });
  });

  describe('object properties', () => {
    const guard = createGuard<{ data: object }>({
      data: { type: 'object' },
    });

    it('returns true when property is an object', () => {
      expect(guard({ data: {} })).toBe(true);
      expect(guard({ data: { key: 'value' } })).toBe(true);
    });

    it('returns false when property is null', () => {
      expect(guard({ data: null })).toBe(false);
    });

    it('returns false when property is not an object', () => {
      expect(guard({ data: 'string' })).toBe(false);
      expect(guard({ data: 42 })).toBe(false);
    });

    it('returns true when property is an array (arrays are objects)', () => {
      // Note: typeof [] === 'object', so arrays pass object check
      // Use 'array' type if you need specifically arrays
      expect(guard({ data: [] })).toBe(true);
    });
  });

  describe('complex schemas', () => {
    interface User {
      id: string;
      name: string;
      age?: number;
      roles: string[];
      validate: () => boolean;
    }

    const isUser = createGuard<User>({
      id: { type: 'string', nonEmpty: true },
      name: { type: 'string' },
      age: { type: 'number', optional: true },
      roles: { type: 'array' },
      validate: { type: 'function' },
    });

    it('returns true for valid complex object', () => {
      expect(
        isUser({
          id: 'user-1',
          name: 'John',
          roles: ['admin'],
          validate: () => true,
        })
      ).toBe(true);
    });

    it('returns true for valid object with all optional fields', () => {
      expect(
        isUser({
          id: 'user-1',
          name: 'John',
          age: 30,
          roles: ['admin', 'user'],
          validate: () => true,
        })
      ).toBe(true);
    });

    it('returns false when any required field is invalid', () => {
      expect(
        isUser({
          id: '', // nonEmpty fails
          name: 'John',
          roles: ['admin'],
          validate: () => true,
        })
      ).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns true for empty schema (any object passes)', () => {
      const guard = createGuard({});
      expect(guard({})).toBe(true);
      expect(guard({ anything: 'goes' })).toBe(true);
    });

    it('allows extra properties not in schema', () => {
      const guard = createGuard({ id: { type: 'string' } });
      expect(guard({ id: 'test', extra: 'ignored' })).toBe(true);
    });
  });
});
