export interface SourceConfig {
  /** Relative to config file */
  path: string;
  include: string[];
  /** .roux/ always excluded (hardcoded) */
  exclude: string[];
}

export interface CacheConfig {
  /** SQLite directory */
  path: string;
}

export type ModelChangeBehavior = 'lazy' | 'eager';

export interface SystemConfig {
  /** Embedding regeneration strategy */
  onModelChange: ModelChangeBehavior;
}

export type FilenameSeparator = 'space' | 'dash';
export type TitleCasing = 'title' | 'sentence' | 'as-is';

export interface NamingConventions {
  /** Word separator in filenames: 'space' (default) or 'dash' */
  filename: FilenameSeparator;
  /** Casing for derived titles (ignored when title is explicit) */
  title: TitleCasing;
}

export const DEFAULT_NAMING: NamingConventions = {
  filename: 'space',
  title: 'title',
};

export interface DocStoreConfig {
  type: 'docstore';
}

export interface LocalEmbeddingConfig {
  type: 'local';
  /** Default: Xenova/all-MiniLM-L6-v2 */
  model?: string;
}

export interface OllamaEmbeddingConfig {
  type: 'ollama';
  model: string;
  endpoint?: string;
  timeout?: number;
}

export interface OpenAIEmbeddingConfig {
  type: 'openai';
  model: string;
  timeout?: number;
}

export type EmbeddingConfig =
  | LocalEmbeddingConfig
  | OllamaEmbeddingConfig
  | OpenAIEmbeddingConfig;

export interface OllamaLLMConfig {
  type: 'ollama';
  model: string;
  endpoint?: string;
  timeout?: number;
}

export interface OpenAILLMConfig {
  type: 'openai';
  model: string;
  timeout?: number;
}

export type LLMConfig = OllamaLLMConfig | OpenAILLMConfig;

export type StoreConfig = DocStoreConfig;

export interface ProvidersConfig {
  store: StoreConfig;
  /** Defaults to local */
  embedding?: EmbeddingConfig;
  llm?: LLMConfig;
}

export interface RouxConfig {
  source?: SourceConfig;
  cache?: CacheConfig;
  system?: SystemConfig;
  naming?: NamingConventions;
  providers: ProvidersConfig;
}

export const DEFAULT_CONFIG: Required<
  Pick<RouxConfig, 'source' | 'cache' | 'system'>
> & { providers: { store: DocStoreConfig } } = {
  source: {
    path: '.',
    include: ['*.md'],
    exclude: [],
  },
  cache: {
    path: '.roux/',
  },
  system: {
    onModelChange: 'lazy',
  },
  providers: {
    store: {
      type: 'docstore',
    },
  },
};
