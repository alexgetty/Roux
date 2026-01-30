import type { GraphCore } from '../../types/graphcore.js';
import type { Store } from '../../types/provider.js';
import type { NamingConventions } from '../../types/config.js';

export interface HandlerContext {
  core: GraphCore;
  store: Store;
  hasEmbedding: boolean;
  naming: NamingConventions;
}
