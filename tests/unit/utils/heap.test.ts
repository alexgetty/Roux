import { describe, it, expect } from 'vitest';
import { MinHeap } from '../../../src/utils/heap.js';

describe('MinHeap', () => {
  describe('basic operations', () => {
    it('starts empty', () => {
      const heap = new MinHeap<number>((a, b) => a - b);
      expect(heap.size()).toBe(0);
      expect(heap.peek()).toBeUndefined();
    });

    it('push increases size', () => {
      const heap = new MinHeap<number>((a, b) => a - b);
      heap.push(5);
      expect(heap.size()).toBe(1);
      heap.push(3);
      expect(heap.size()).toBe(2);
    });

    it('peek returns minimum without removing', () => {
      const heap = new MinHeap<number>((a, b) => a - b);
      heap.push(5);
      heap.push(3);
      heap.push(7);
      expect(heap.peek()).toBe(3);
      expect(heap.size()).toBe(3);
    });

    it('pop removes and returns minimum', () => {
      const heap = new MinHeap<number>((a, b) => a - b);
      heap.push(5);
      heap.push(3);
      heap.push(7);
      expect(heap.pop()).toBe(3);
      expect(heap.size()).toBe(2);
      expect(heap.pop()).toBe(5);
      expect(heap.pop()).toBe(7);
      expect(heap.pop()).toBeUndefined();
    });

    it('pop returns undefined when empty', () => {
      const heap = new MinHeap<number>((a, b) => a - b);
      expect(heap.pop()).toBeUndefined();
    });
  });

  describe('heap property', () => {
    it('maintains min at top after many insertions', () => {
      const heap = new MinHeap<number>((a, b) => a - b);
      const values = [10, 4, 15, 20, 0, 8, 2];
      values.forEach(v => heap.push(v));
      expect(heap.peek()).toBe(0);
    });

    it('extracts values in sorted order', () => {
      const heap = new MinHeap<number>((a, b) => a - b);
      const values = [10, 4, 15, 20, 0, 8, 2];
      values.forEach(v => heap.push(v));

      const extracted: number[] = [];
      while (heap.size() > 0) {
        extracted.push(heap.pop()!);
      }
      expect(extracted).toEqual([0, 2, 4, 8, 10, 15, 20]);
    });
  });

  describe('custom comparator', () => {
    it('works with tuple comparator for top-k pattern', () => {
      const heap = new MinHeap<[string, number]>((a, b) => a[1] - b[1]);
      heap.push(['a', 10]);
      heap.push(['b', 5]);
      heap.push(['c', 15]);

      expect(heap.peek()).toEqual(['b', 5]);
      expect(heap.pop()).toEqual(['b', 5]);
      expect(heap.pop()).toEqual(['a', 10]);
      expect(heap.pop()).toEqual(['c', 15]);
    });

    it('supports top-k selection by evicting minimum', () => {
      const heap = new MinHeap<[string, number]>((a, b) => a[1] - b[1]);
      const k = 3;
      const items: Array<[string, number]> = [
        ['a', 10], ['b', 5], ['c', 20], ['d', 15], ['e', 3], ['f', 25]
      ];

      for (const item of items) {
        if (heap.size() < k) {
          heap.push(item);
        } else if (item[1] > heap.peek()![1]) {
          heap.pop();
          heap.push(item);
        }
      }

      expect(heap.size()).toBe(3);
      // Min-heap contains top 3: 15, 20, 25
      const result: Array<[string, number]> = [];
      while (heap.size() > 0) {
        result.push(heap.pop()!);
      }
      // Extracted in ascending order
      expect(result.map(r => r[1])).toEqual([15, 20, 25]);
    });
  });

  describe('toArray', () => {
    it('returns all elements', () => {
      const heap = new MinHeap<number>((a, b) => a - b);
      heap.push(5);
      heap.push(3);
      heap.push(7);
      const arr = heap.toArray();
      expect(arr).toHaveLength(3);
      expect(arr.sort((a, b) => a - b)).toEqual([3, 5, 7]);
    });

    it('does not modify heap', () => {
      const heap = new MinHeap<number>((a, b) => a - b);
      heap.push(5);
      heap.push(3);
      heap.toArray();
      expect(heap.size()).toBe(2);
      expect(heap.peek()).toBe(3);
    });
  });
});
