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

/** Caller-settable fields for updateNode. No id (immutable), no outgoingLinks (derived from content). */
export interface NodeUpdates {
  title?: string;
  content?: string;
  tags?: string[];
  properties?: Record<string, unknown>;
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

  // Validate required fields
  if (
    typeof obj['id'] !== 'string' ||
    typeof obj['title'] !== 'string' ||
    typeof obj['content'] !== 'string'
  ) {
    return false;
  }

  // Validate tags array
  if (
    !Array.isArray(obj['tags']) ||
    !obj['tags'].every((t) => typeof t === 'string')
  ) {
    return false;
  }

  // Validate outgoingLinks array
  if (
    !Array.isArray(obj['outgoingLinks']) ||
    !obj['outgoingLinks'].every((l) => typeof l === 'string')
  ) {
    return false;
  }

  // Validate properties is a plain object (not null, not array)
  if (
    typeof obj['properties'] !== 'object' ||
    obj['properties'] === null ||
    Array.isArray(obj['properties'])
  ) {
    return false;
  }

  // Validate sourceRef if present
  if (obj['sourceRef'] !== undefined && !isSourceRef(obj['sourceRef'])) {
    return false;
  }

  return true;
}

export function isSourceRef(value: unknown): value is SourceRef {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  const validTypes = ['file', 'api', 'manual'];

  if (
    typeof obj['type'] !== 'string' ||
    !validTypes.includes(obj['type'])
  ) {
    return false;
  }

  if (obj['path'] !== undefined && typeof obj['path'] !== 'string') {
    return false;
  }

  if (obj['lastModified'] !== undefined) {
    if (!(obj['lastModified'] instanceof Date)) {
      return false;
    }
    // Reject Invalid Date objects
    if (isNaN(obj['lastModified'].getTime())) {
      return false;
    }
  }

  return true;
}
