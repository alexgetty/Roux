export type Direction = 'in' | 'out' | 'both';

export interface NeighborOptions {
  direction: Direction;
  type?: string;
  minWeight?: number;
  limit?: number;
}

/** Future first-class model. Currently implicit via Node.outgoingLinks. */
export interface Edge {
  source: string;
  target: string;
  /** e.g. parent, related */
  type?: string;
  weight?: number;
  properties?: Record<string, unknown>;
}
