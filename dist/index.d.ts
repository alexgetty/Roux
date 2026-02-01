import { DirectedGraph } from 'graphology';
import { Database } from 'better-sqlite3';

interface SourceRef {
    type: 'file' | 'api' | 'manual';
    path?: string;
    lastModified?: Date;
}
/** The canonical data model. All modules speak Node. */
interface Node {
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
interface NodeUpdates {
    title?: string;
    content?: string;
    tags?: string[];
    properties?: Record<string, unknown>;
}
interface NodeWithContext extends Node {
    /** Populated when depth > 0 */
    neighbors?: Node[];
    incomingCount?: number;
    outgoingCount?: number;
}
declare function isNode(value: unknown): value is Node;
declare function isSourceRef(value: unknown): value is SourceRef;

type Direction = 'in' | 'out' | 'both';
interface NeighborOptions {
    direction: Direction;
    limit?: number;
}
/** Future first-class model. Currently implicit via Node.outgoingLinks. */
interface Edge {
    source: string;
    target: string;
    /** e.g. parent, related */
    type?: string;
    weight?: number;
    properties?: Record<string, unknown>;
}

type Metric = 'in_degree' | 'out_degree';
interface ListFilter {
    /** Filter by tag (case-insensitive) */
    tag?: string;
    /** Filter by path prefix (startsWith) */
    path?: string;
}
interface ListOptions {
    /** Default 100, max 1000 */
    limit?: number;
    /** Default 0 */
    offset?: number;
}
interface NodeSummary {
    id: string;
    title: string;
}
interface ListNodesResult {
    nodes: NodeSummary[];
    /** Total matching nodes (before limit/offset applied) */
    total: number;
}
type ResolveStrategy = 'exact' | 'fuzzy' | 'semantic';
interface ResolveOptions {
    /** Filter candidates by tag */
    tag?: string;
    /** Filter candidates by path prefix */
    path?: string;
    /** 0-1, default 0.7, ignored for 'exact' */
    threshold?: number;
    /** Default 'fuzzy' */
    strategy?: ResolveStrategy;
}
interface ResolveResult {
    /** Original input */
    query: string;
    /** Matched node ID or null */
    match: string | null;
    /** 0-1, 0 if no match */
    score: number;
}
interface CentralityMetrics {
    inDegree: number;
    outDegree: number;
}
type TagMode = 'any' | 'all';
interface VectorSearchResult {
    id: string;
    distance: number;
}
/** Link with resolved title for MCP responses. */
interface LinkInfo {
    id: string;
    title: string;
}
/** Base fields all providers must implement. */
interface ProviderBase {
    /** Unique identifier for this provider instance. Must be non-empty. */
    readonly id: string;
}
/**
 * Optional lifecycle hooks for providers.
 * - onRegister: Called after registration with GraphCore. Errors propagate to caller.
 * - onUnregister: Called before provider is replaced or GraphCore is destroyed. Best-effort, errors logged.
 */
interface ProviderLifecycle {
    onRegister?(): Promise<void>;
    onUnregister?(): Promise<void>;
}
/** Data persistence and graph operations. Required provider. */
interface Store extends ProviderBase, ProviderLifecycle {
    createNode(node: Node): Promise<void>;
    updateNode(id: string, updates: NodeUpdates): Promise<void>;
    deleteNode(id: string): Promise<void>;
    getNode(id: string): Promise<Node | null>;
    getNodes(ids: string[]): Promise<Node[]>;
    getNeighbors(id: string, options: NeighborOptions): Promise<Node[]>;
    findPath(source: string, target: string): Promise<string[] | null>;
    getHubs(metric: Metric, limit: number): Promise<Array<[string, number]>>;
    storeEmbedding(id: string, vector: number[], model: string): Promise<void>;
    searchByVector(vector: number[], limit: number): Promise<VectorSearchResult[]>;
    searchByTags(tags: string[], mode: TagMode, limit?: number): Promise<Node[]>;
    getRandomNode(tags?: string[]): Promise<Node | null>;
    resolveTitles(ids: string[]): Promise<Map<string, string>>;
    listNodes(filter: ListFilter, options?: ListOptions): Promise<ListNodesResult>;
    resolveNodes(names: string[], options?: ResolveOptions): Promise<ResolveResult[]>;
    nodesExist(ids: string[]): Promise<Map<string, boolean>>;
}
/** Stateless vector generation. Storage handled by Store. */
interface Embedding extends ProviderBase, ProviderLifecycle {
    embed(text: string): Promise<number[]>;
    embedBatch(texts: string[]): Promise<number[][]>;
    /** For storage allocation */
    dimensions(): number;
    modelId(): string;
}
/** Pluggable vector storage and similarity search. */
interface VectorIndex {
    store(id: string, vector: number[], model: string): Promise<void>;
    search(vector: number[], limit: number): Promise<VectorSearchResult[]>;
    delete(id: string): Promise<void>;
    getModel(id: string): Promise<string | null>;
    hasEmbedding(id: string): boolean;
}
declare function isVectorIndex(value: unknown): value is VectorIndex;

type PropertyType = 'string' | 'number' | 'boolean' | 'function' | 'object' | 'array';
interface PropertySchema {
    type: PropertyType;
    optional?: boolean;
    /** For 'string' type, require non-empty */
    nonEmpty?: boolean;
}
type Schema = Record<string, PropertySchema>;
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
declare function createGuard<T>(schema: Schema): (value: unknown) => value is T;

interface SearchOptions {
    /** Default: 10 */
    limit?: number;
    /** 0-1 */
    threshold?: number;
    tags?: string[];
}
/** Orchestration hub. Zero functionality without providers. */
interface GraphCore {
    registerStore(provider: Store): Promise<void>;
    registerEmbedding(provider: Embedding): Promise<void>;
    destroy(): Promise<void>;
    search(query: string, options?: SearchOptions): Promise<Node[]>;
    getNode(id: string, depth?: number): Promise<NodeWithContext | null>;
    createNode(node: Partial<Node>): Promise<Node>;
    updateNode(id: string, updates: NodeUpdates): Promise<Node>;
    deleteNode(id: string): Promise<boolean>;
    getNeighbors(id: string, options: NeighborOptions): Promise<Node[]>;
    findPath(source: string, target: string): Promise<string[] | null>;
    getHubs(metric: Metric, limit: number): Promise<Array<[string, number]>>;
    searchByTags(tags: string[], mode: TagMode, limit?: number): Promise<Node[]>;
    getRandomNode(tags?: string[]): Promise<Node | null>;
    listNodes(filter: ListFilter, options?: ListOptions): Promise<ListNodesResult>;
    resolveNodes(names: string[], options?: ResolveOptions): Promise<ResolveResult[]>;
}

interface SourceConfig {
    /** Relative to config file */
    path: string;
    include: string[];
    /** .roux/ always excluded (hardcoded) */
    exclude: string[];
}
interface CacheConfig {
    /** SQLite directory */
    path: string;
}
type ModelChangeBehavior = 'lazy' | 'eager';
interface SystemConfig {
    onModelChange: ModelChangeBehavior;
}
type FilenameSeparator = 'space' | 'dash';
type TitleCasing = 'title' | 'sentence' | 'as-is';
interface NamingConventions {
    filename: FilenameSeparator;
    title: TitleCasing;
}
interface DocStoreConfig {
    type: 'docstore';
}
interface LocalEmbeddingConfig {
    type: 'local';
    /** Default: Xenova/all-MiniLM-L6-v2 */
    model?: string;
}
interface OllamaEmbeddingConfig {
    type: 'ollama';
    model: string;
    endpoint?: string;
    timeout?: number;
}
interface OpenAIEmbeddingConfig {
    type: 'openai';
    model: string;
    timeout?: number;
}
type EmbeddingConfig = LocalEmbeddingConfig | OllamaEmbeddingConfig | OpenAIEmbeddingConfig;
interface OllamaLLMConfig {
    type: 'ollama';
    model: string;
    endpoint?: string;
    timeout?: number;
}
interface OpenAILLMConfig {
    type: 'openai';
    model: string;
    timeout?: number;
}
type LLMConfig = OllamaLLMConfig | OpenAILLMConfig;
type StoreConfig = DocStoreConfig;
interface ProvidersConfig {
    store: StoreConfig;
    embedding?: EmbeddingConfig;
    llm?: LLMConfig;
}
interface RouxConfig {
    source?: SourceConfig;
    cache?: CacheConfig;
    system?: SystemConfig;
    naming?: NamingConventions;
    providers: ProvidersConfig;
}
declare const DEFAULT_CONFIG: Required<Pick<RouxConfig, 'source' | 'cache' | 'system'>> & {
    providers: {
        store: DocStoreConfig;
    };
};

declare class GraphCoreImpl implements GraphCore {
    private store;
    private embedding;
    registerStore(provider: Store): Promise<void>;
    registerEmbedding(provider: Embedding): Promise<void>;
    destroy(): Promise<void>;
    private requireStore;
    private requireEmbedding;
    search(query: string, options?: SearchOptions): Promise<Node[]>;
    getNode(id: string, depth?: number): Promise<NodeWithContext | null>;
    createNode(partial: Partial<Node>): Promise<Node>;
    updateNode(id: string, updates: NodeUpdates): Promise<Node>;
    deleteNode(id: string): Promise<boolean>;
    getNeighbors(id: string, options: NeighborOptions): Promise<Node[]>;
    findPath(source: string, target: string): Promise<string[] | null>;
    getHubs(metric: Metric, limit: number): Promise<Array<[string, number]>>;
    searchByTags(tags: string[], mode: TagMode, limit?: number): Promise<Node[]>;
    getRandomNode(tags?: string[]): Promise<Node | null>;
    listNodes(filter: ListFilter, options?: ListOptions): Promise<ListNodesResult>;
    resolveNodes(names: string[], options?: ResolveOptions): Promise<ResolveResult[]>;
    static fromConfig(config: RouxConfig): Promise<GraphCoreImpl>;
}

declare class GraphManager {
    private graph;
    /** Build graph and return centrality metrics. Caller stores as needed. */
    build(nodes: Node[]): Map<string, CentralityMetrics>;
    /** Throws GraphNotReadyError if not built. Returns graph for query use. */
    assertReady(): DirectedGraph;
    isReady(): boolean;
    getNeighborIds(id: string, options: NeighborOptions): string[];
    findPath(source: string, target: string): string[] | null;
    getHubs(metric: Metric, limit: number): Array<[string, number]>;
}

interface StoreProviderOptions {
    vectorIndex?: VectorIndex;
}
declare abstract class StoreProvider {
    protected readonly graphManager: GraphManager;
    protected readonly vectorIndex: VectorIndex | null;
    constructor(options?: StoreProviderOptions);
    protected abstract loadAllNodes(): Promise<Node[]>;
    protected abstract getNodesByIds(ids: string[]): Promise<Node[]>;
    abstract createNode(node: Node): Promise<void>;
    abstract updateNode(id: string, updates: NodeUpdates): Promise<void>;
    abstract deleteNode(id: string): Promise<void>;
    abstract getNode(id: string): Promise<Node | null>;
    abstract getNodes(ids: string[]): Promise<Node[]>;
    abstract close(): void;
    getNeighbors(id: string, options: NeighborOptions): Promise<Node[]>;
    findPath(source: string, target: string): Promise<string[] | null>;
    getHubs(metric: Metric, limit: number): Promise<Array<[string, number]>>;
    storeEmbedding(id: string, vector: number[], model: string): Promise<void>;
    searchByVector(vector: number[], limit: number): Promise<VectorSearchResult[]>;
    getRandomNode(tags?: string[]): Promise<Node | null>;
    searchByTags(tags: string[], mode: TagMode, limit?: number): Promise<Node[]>;
    listNodes(filter: ListFilter, options?: ListOptions): Promise<ListNodesResult>;
    nodesExist(ids: string[]): Promise<Map<string, boolean>>;
    resolveTitles(ids: string[]): Promise<Map<string, string>>;
    resolveNodes(names: string[], options?: ResolveOptions): Promise<ResolveResult[]>;
    protected syncGraph(): Promise<void>;
    protected onCentralityComputed(_centrality: Map<string, CentralityMetrics>): void;
}

/**
 * FileWatcher - Pure file system event emitter
 *
 * Responsibilities:
 * - Wraps chokidar
 * - Filters (.md only, excluded dirs)
 * - Coalesces events
 * - Debounces
 * - Emits batched events via callback
 */

type FileEventType = 'add' | 'change' | 'unlink';
interface FileWatcherOptions {
    root: string;
    /** File extensions to watch (e.g., new Set(['.md', '.markdown'])). Required. */
    extensions: ReadonlySet<string>;
    debounceMs?: number;
    /** Called after debounce with coalesced events. Exceptions (sync or async) are
     *  logged and swallowed; watcher continues operating. */
    onBatch: (events: Map<string, FileEventType>) => void | Promise<void>;
}
declare class FileWatcher {
    private readonly root;
    private readonly extensions;
    private readonly debounceMs;
    private readonly onBatch;
    private watcher;
    private debounceTimer;
    private pendingChanges;
    private isPaused;
    constructor(options: FileWatcherOptions);
    start(): Promise<void>;
    stop(): void;
    isWatching(): boolean;
    pause(): void;
    resume(): void;
    flush(): void;
    private queueChange;
}

/**
 * FormatReader plugin types
 *
 * Extracted to break circular dependency between reader-registry and readers.
 */

/**
 * Result of parsing a file through ReaderRegistry
 */
interface ParseResult {
    node: Node;
    /** True if the file needs a stable frontmatter ID written */
    needsIdWrite: boolean;
}
/**
 * Context provided to readers during parsing
 */
interface FileContext {
    /** Full absolute path to the file */
    absolutePath: string;
    /** Path relative to source root (becomes node ID) */
    relativePath: string;
    /** File extension including dot (e.g., '.md') */
    extension: string;
    /** File modification time */
    mtime: Date;
}
/**
 * Interface for format-specific file readers
 */
interface FormatReader {
    /** Extensions this reader handles (e.g., ['.md', '.markdown']) */
    readonly extensions: string[];
    /** Parse file content into a Node */
    parse(content: string, context: FileContext): Node;
}

/**
 * FormatReader plugin architecture
 *
 * Provides a registry for file format readers, enabling multi-format support
 * in DocStore while keeping format-specific logic isolated.
 */

/**
 * Registry for FormatReader implementations
 */
declare class ReaderRegistry {
    private readers;
    /**
     * Register a reader for its declared extensions.
     * Throws if any extension is already registered (atomic - no partial registration).
     */
    register(reader: FormatReader): void;
    /**
     * Get reader for an extension, or null if none registered.
     * Case-insensitive.
     */
    getReader(extension: string): FormatReader | null;
    /**
     * Get all registered extensions
     */
    getExtensions(): ReadonlySet<string>;
    /**
     * Check if an extension has a registered reader.
     * Case-insensitive.
     */
    hasReader(extension: string): boolean;
    /**
     * Parse content using the appropriate reader for the file's extension.
     * Validates frontmatter ID and signals if writeback is needed.
     * Throws if no reader is registered for the extension.
     *
     * Note: Does NOT generate new IDs here - that happens in Phase 3's writeback.
     * Files without valid frontmatter IDs keep their path-based ID for now,
     * with needsIdWrite: true signaling that an ID should be generated and written.
     */
    parse(content: string, context: FileContext): ParseResult;
}

interface DocStoreOptions {
    sourceRoot: string;
    cacheDir: string;
    id?: string;
    vectorIndex?: VectorIndex;
    registry?: ReaderRegistry;
    /** Optional FileWatcher instance. If provided, DocStore uses it instead of creating one. */
    fileWatcher?: FileWatcher;
}
declare class DocStore extends StoreProvider {
    readonly id: string;
    private cache;
    private sourceRoot;
    private ownsVectorIndex;
    private registry;
    private fileWatcher;
    private onChangeCallback;
    constructor(options: DocStoreOptions);
    sync(): Promise<void>;
    createNode(node: Node): Promise<void>;
    updateNode(id: string, updates: NodeUpdates): Promise<void>;
    deleteNode(id: string): Promise<void>;
    getNode(id: string): Promise<Node | null>;
    getNodes(ids: string[]): Promise<Node[]>;
    getAllNodeIds(): Promise<string[]>;
    searchByTags(tags: string[], mode: TagMode, limit?: number): Promise<Node[]>;
    resolveTitles(ids: string[]): Promise<Map<string, string>>;
    listNodes(filter: ListFilter, options?: ListOptions): Promise<ListNodesResult>;
    resolveNodes(names: string[], options?: ResolveOptions): Promise<ResolveResult[]>;
    nodesExist(ids: string[]): Promise<Map<string, boolean>>;
    hasEmbedding(id: string): boolean;
    close(): void;
    onRegister(): Promise<void>;
    onUnregister(): Promise<void>;
    startWatching(onChange?: (changedIds: string[]) => void): Promise<void>;
    stopWatching(): void;
    isWatching(): boolean;
    private handleWatcherBatch;
    private resolveAllLinks;
    getNeighbors(id: string, options: {
        direction: 'in' | 'out' | 'both';
        limit?: number;
    }): Promise<Node[]>;
    findPath(source: string, target: string): Promise<string[] | null>;
    getHubs(metric: 'in_degree' | 'out_degree', limit: number): Promise<Array<[string, number]>>;
    protected loadAllNodes(): Promise<Node[]>;
    protected getNodesByIds(ids: string[]): Promise<Node[]>;
    protected onCentralityComputed(centrality: Map<string, CentralityMetrics>): void;
    /**
     * Parse a file and optionally write a generated ID back if missing.
     * Returns the node (with stable ID) and whether a write occurred.
     */
    private parseAndMaybeWriteId;
    /**
     * Write a generated ID back to file's frontmatter.
     * Returns false if file was modified since originalMtime (race condition).
     */
    private writeIdBack;
}

interface TransformersEmbeddingOptions {
    model?: string;
    dimensions?: number;
    id?: string;
}
declare class TransformersEmbedding implements Embedding {
    readonly id: string;
    private model;
    private dims;
    private pipe;
    constructor(options?: TransformersEmbeddingOptions);
    private getPipeline;
    embed(text: string): Promise<number[]>;
    embedBatch(texts: string[]): Promise<number[][]>;
    dimensions(): number;
    modelId(): string;
    onRegister(): Promise<void>;
    onUnregister(): Promise<void>;
}

declare class SqliteVectorIndex implements VectorIndex {
    private db;
    private ownsDb;
    private modelMismatchWarned;
    constructor(pathOrDb: string | Database);
    private init;
    store(id: string, vector: number[], model: string): Promise<void>;
    search(vector: number[], limit: number): Promise<VectorSearchResult[]>;
    delete(id: string): Promise<void>;
    getModel(id: string): Promise<string | null>;
    hasEmbedding(id: string): boolean;
    /** For testing: get table names */
    getTableNames(): string[];
    /** For testing: get vector blob size */
    getVectorBlobSize(id: string): number | null;
    /** Get total number of stored embeddings */
    getEmbeddingCount(): number;
    close(): void;
}

declare const VERSION = "0.1.3";

export { type CacheConfig, type CentralityMetrics, DEFAULT_CONFIG, type Direction, DocStore, type DocStoreConfig, type Edge, type Embedding, type EmbeddingConfig, type GraphCore, GraphCoreImpl, type LLMConfig, type LinkInfo, type ListFilter, type ListOptions, type LocalEmbeddingConfig, type Metric, type ModelChangeBehavior, type NeighborOptions, type Node, type NodeSummary, type NodeUpdates, type NodeWithContext, type OllamaEmbeddingConfig, type OllamaLLMConfig, type OpenAIEmbeddingConfig, type OpenAILLMConfig, type PropertySchema, type PropertyType, type ProvidersConfig, type ResolveOptions, type ResolveResult, type ResolveStrategy, type RouxConfig, type Schema, type SearchOptions, type SourceConfig, type SourceRef, SqliteVectorIndex, type Store, type StoreConfig, StoreProvider, type StoreProviderOptions, type SystemConfig, type TagMode, TransformersEmbedding, VERSION, type VectorIndex, type VectorSearchResult, createGuard, isNode, isSourceRef, isVectorIndex };
