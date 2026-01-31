export type PropertyType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'function'
  | 'object'
  | 'array';

export interface PropertySchema {
  type: PropertyType;
  optional?: boolean;
  /** For 'string' type, require non-empty */
  nonEmpty?: boolean;
}

export type Schema = Record<string, PropertySchema>;

/**
 * Create a type guard function from a schema definition.
 *
 * @example
 * const isUser = createGuard<User>({
 *   id: { type: 'string', nonEmpty: true },
 *   name: { type: 'string' },
 *   age: { type: 'number', optional: true },
 * });
 */
export function createGuard<T>(schema: Schema): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    if (value === null || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;

    for (const [key, spec] of Object.entries(schema)) {
      const val = obj[key];

      if (spec.optional && val === undefined) continue;

      if (spec.type === 'array') {
        if (!Array.isArray(val)) return false;
      } else if (spec.type === 'object') {
        if (typeof val !== 'object' || val === null) return false;
      } else {
        if (typeof val !== spec.type) return false;
      }

      if (spec.nonEmpty && spec.type === 'string' && (val as string).length === 0) {
        return false;
      }
    }

    return true;
  };
}
