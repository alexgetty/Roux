// Roux - Graph Programming Interface

export const VERSION = '0.1.3';

// Re-export all types
export * from './types/index.js';

// Core
export { GraphCoreImpl } from './core/graphcore.js';

// Providers
export { StoreProvider, type StoreProviderOptions } from './providers/store/index.js';
export { DocStore } from './providers/docstore/index.js';
export { TransformersEmbedding } from './providers/embedding/index.js';
export { SqliteVectorIndex } from './providers/vector/index.js';
