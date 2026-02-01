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

import { watch, type FSWatcher } from 'chokidar';
import { relative, extname } from 'node:path';
import { EXCLUDED_DIRS } from './constants.js';

// Re-export for backwards compatibility
export { EXCLUDED_DIRS } from './constants.js';

export type FileEventType = 'add' | 'change' | 'unlink';

export interface FileWatcherOptions {
  root: string;
  /** File extensions to watch (e.g., new Set(['.md', '.markdown'])). Required. */
  extensions: ReadonlySet<string>;
  debounceMs?: number;
  /** Called after debounce with coalesced events. Exceptions (sync or async) are
   *  logged and swallowed; watcher continues operating. */
  onBatch: (events: Map<string, FileEventType>) => void | Promise<void>;
}

const DEFAULT_DEBOUNCE_MS = 1000;

export class FileWatcher {
  private readonly root: string;
  private readonly extensions: ReadonlySet<string>;
  private readonly debounceMs: number;
  private readonly onBatch: (events: Map<string, FileEventType>) => void | Promise<void>;

  private watcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingChanges: Map<string, FileEventType> = new Map();
  private isPaused = false;

  constructor(options: FileWatcherOptions) {
    this.root = options.root;
    this.extensions = options.extensions;
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.onBatch = options.onBatch;
  }

  start(): Promise<void> {
    if (this.watcher) {
      return Promise.reject(new Error('Already watching. Call stop() first.'));
    }

    return new Promise((resolve, reject) => {
      let isReady = false;

      this.watcher = watch(this.root, {
        ignoreInitial: true,
        ignored: [...EXCLUDED_DIRS].map((dir) => `**/${dir}/**`),
        awaitWriteFinish: {
          stabilityThreshold: 100,
        },
        followSymlinks: false,
      });

      this.watcher
        .on('ready', () => {
          isReady = true;
          resolve();
        })
        .on('add', (path) => this.queueChange(path, 'add'))
        .on('change', (path) => this.queueChange(path, 'change'))
        .on('unlink', (path) => this.queueChange(path, 'unlink'))
        .on('error', (err) => {
          if ((err as NodeJS.ErrnoException).code === 'EMFILE') {
            console.error(
              'File watcher hit file descriptor limit. ' +
                'Try: ulimit -n 65536 or reduce watched files.'
            );
          }
          if (isReady) {
            // Error after ready - log and continue (graceful degradation)
            console.error('FileWatcher error:', err);
          } else {
            // Error during startup - reject the promise
            reject(err);
          }
        });
    });
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingChanges.clear();

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  isWatching(): boolean {
    return this.watcher !== null;
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  flush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.pendingChanges.size === 0) {
      return;
    }

    const batch = new Map(this.pendingChanges);
    this.pendingChanges.clear();

    try {
      const result = this.onBatch(batch);
      // Handle async onBatch (returns Promise)
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch((err) => {
          console.error('FileWatcher onBatch callback threw an error:', err);
        });
      }
    } catch (err) {
      console.error('FileWatcher onBatch callback threw an error:', err);
    }
  }

  private queueChange(filePath: string, event: FileEventType): void {
    if (this.isPaused) return;

    const relativePath = relative(this.root, filePath);

    // Filter by extension using path.extname for correctness
    const ext = extname(filePath).toLowerCase();
    if (!ext || !this.extensions.has(ext)) {
      return;
    }

    // Filter: excluded directories
    const pathParts = relativePath.split('/');
    for (const part of pathParts) {
      if (EXCLUDED_DIRS.has(part)) {
        return;
      }
    }

    // Normalize ID (lowercase, forward slashes)
    const id = relativePath.toLowerCase().replace(/\\/g, '/');

    // Apply coalescing rules
    const existing = this.pendingChanges.get(id);

    if (existing) {
      if (existing === 'add' && event === 'change') {
        // add + change = add (keep as add)
        return;
      } else if (existing === 'add' && event === 'unlink') {
        // add + unlink = remove from queue
        this.pendingChanges.delete(id);
        // If queue is now empty, clear timer and return early (no wasted flush)
        if (this.pendingChanges.size === 0) {
          if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
          }
          return;
        }
      } else if (existing === 'change' && event === 'unlink') {
        // change + unlink = unlink
        this.pendingChanges.set(id, 'unlink');
      } else if (existing === 'change' && event === 'add') {
        // change + add = add (delete was missed, treat as new file)
        this.pendingChanges.set(id, 'add');
      } else if (existing === 'unlink' && event === 'add') {
        // unlink + add = add (file deleted then re-created)
        this.pendingChanges.set(id, 'add');
      } else if (existing === 'unlink' && event === 'change') {
        // unlink + change = unlink (spurious change ignored)
        return;
      }
      // change + change = change (already set, no action needed)
    } else {
      this.pendingChanges.set(id, event);
    }

    // Reset debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flush();
    }, this.debounceMs);
  }
}
