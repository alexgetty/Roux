import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import type { Embedding } from '../../types/provider.js';

const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';
const DEFAULT_DIMENSIONS = 384;

export interface TransformersEmbeddingOptions {
  model?: string;
  dimensions?: number;
  id?: string;
}

export class TransformersEmbedding implements Embedding {
  readonly id: string;
  private model: string;
  private dims: number;
  private pipe: FeatureExtractionPipeline | null = null;

  constructor(options: TransformersEmbeddingOptions = {}) {
    const {
      model = DEFAULT_MODEL,
      dimensions = DEFAULT_DIMENSIONS,
      id = 'transformers-embedding',
    } = options;
    this.id = id;
    this.model = model;
    this.dims = dimensions;
  }

  private async getPipeline(): Promise<FeatureExtractionPipeline> {
    if (!this.pipe) {
      this.pipe = await pipeline('feature-extraction', this.model);
    }
    return this.pipe;
  }

  async embed(text: string): Promise<number[]> {
    const pipe = await this.getPipeline();
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    return Promise.all(texts.map((t) => this.embed(t)));
  }

  dimensions(): number {
    return this.dims;
  }

  modelId(): string {
    return this.model;
  }

  // Lifecycle hooks

  async onRegister(): Promise<void> {
    // No-op: pipeline is lazy-loaded on first embed() call
  }

  async onUnregister(): Promise<void> {
    // Release reference for GC
    // NOTE: @xenova/transformers may not truly unload from GPU memory
    this.pipe = null;
  }
}
