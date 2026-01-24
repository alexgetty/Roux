// Roux - Graph Programming Interface

export const VERSION = '0.1.0';

// Re-export all types
export * from './types/index.js';

// Core
export { GraphCoreImpl } from './core/graphcore.js';

// Providers
export { DocStore } from './providers/docstore/index.js';
export { TransformersEmbeddingProvider } from './providers/embedding/index.js';
export { SqliteVectorProvider } from './providers/vector/index.js';
