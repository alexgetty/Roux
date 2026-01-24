export interface SourceRef {
  type: 'file' | 'api' | 'manual';
  path?: string;
  lastModified?: Date;
}

/** The canonical data model. All modules speak Node. */
export interface Node {
  /** Store-specific format */
  id: string;
  title: string;
  content: string;
  tags: string[];
  /** By id */
  outgoingLinks: string[];
  properties: Record<string, unknown>;
  sourceRef?: SourceRef;
}

export interface NodeWithContext extends Node {
  /** Populated when depth > 0 */
  neighbors?: Node[];
  incomingCount?: number;
  outgoingCount?: number;
}

export function isNode(value: unknown): value is Node {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['title'] === 'string' &&
    typeof obj['content'] === 'string' &&
    Array.isArray(obj['tags']) &&
    obj['tags'].every((t) => typeof t === 'string') &&
    Array.isArray(obj['outgoingLinks']) &&
    obj['outgoingLinks'].every((l) => typeof l === 'string') &&
    typeof obj['properties'] === 'object' &&
    obj['properties'] !== null
  );
}

export function isSourceRef(value: unknown): value is SourceRef {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  const validTypes = ['file', 'api', 'manual'];
  return (
    typeof obj['type'] === 'string' &&
    validTypes.includes(obj['type']) &&
    (obj['path'] === undefined || typeof obj['path'] === 'string') &&
    (obj['lastModified'] === undefined || obj['lastModified'] instanceof Date)
  );
}
