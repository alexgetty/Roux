type Comparator<T> = (a: T, b: T) => number;

/**
 * Min-heap implementation for top-k selection.
 * The smallest element (by comparator) is always at the root.
 */
export class MinHeap<T> {
  private data: T[] = [];
  private compare: Comparator<T>;

  constructor(comparator: Comparator<T>) {
    this.compare = comparator;
  }

  size(): number {
    return this.data.length;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  push(value: T): void {
    this.data.push(value);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    if (this.data.length === 1) return this.data.pop();

    const min = this.data[0];
    this.data[0] = this.data.pop()!;
    this.bubbleDown(0);
    return min;
  }

  toArray(): T[] {
    return [...this.data];
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compare(this.data[index]!, this.data[parentIndex]!) >= 0) {
        break;
      }
      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.data.length;
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < length && this.compare(this.data[leftChild]!, this.data[smallest]!) < 0) {
        smallest = leftChild;
      }
      if (rightChild < length && this.compare(this.data[rightChild]!, this.data[smallest]!) < 0) {
        smallest = rightChild;
      }

      if (smallest === index) break;

      this.swap(index, smallest);
      index = smallest;
    }
  }

  private swap(i: number, j: number): void {
    const temp = this.data[i]!;
    this.data[i] = this.data[j]!;
    this.data[j] = temp;
  }
}
