/**
 * Facade for backwards compatibility.
 * Re-exports from modular handler structure.
 */
export {
  coerceInt,
  dispatchTool,
  getToolDefinitions,
  normalizeCreateId,
  deriveTitle,
  type HandlerContext,
  type ListNodesResponse,
  type NodesExistResponse,
  type ToolResult,
} from './handlers/index.js';

// Re-export individual handlers for tests that import them directly
export { handler as handleSearch } from './handlers/search.js';
export { handler as handleGetNode } from './handlers/get_node.js';
export { handler as handleGetNeighbors } from './handlers/get_neighbors.js';
export { handler as handleFindPath } from './handlers/find_path.js';
export { handler as handleGetHubs } from './handlers/get_hubs.js';
export { handler as handleSearchByTags } from './handlers/search_by_tags.js';
export { handler as handleRandomNode } from './handlers/random_node.js';
export { handler as handleCreateNode } from './handlers/create_node.js';
export { handler as handleUpdateNode } from './handlers/update_node.js';
export { handler as handleDeleteNode } from './handlers/delete_node.js';
export { handler as handleListNodes } from './handlers/list_nodes.js';
export { handler as handleResolveNodes } from './handlers/resolve_nodes.js';
export { handler as handleNodesExist } from './handlers/nodes_exist.js';
