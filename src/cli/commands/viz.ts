import { access, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { Cache } from '../../providers/docstore/cache.js';

export interface VizOptions {
  output?: string | undefined;
  open?: boolean | undefined;
}

export interface VizResult {
  outputPath: string;
  nodeCount: number;
  edgeCount: number;
  shouldOpen: boolean;
}

interface GraphNode {
  id: string;
  title: string;
  inDegree: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

export async function vizCommand(
  directory: string,
  options: VizOptions = {}
): Promise<VizResult> {
  const configPath = join(directory, 'roux.yaml');

  // Check if initialized
  try {
    await access(configPath);
  } catch {
    throw new Error(`Directory not initialized. Run 'roux init' first.`);
  }

  const cacheDir = join(directory, '.roux');
  const outputPath = options.output ?? join(cacheDir, 'graph.html');

  const cache = new Cache(cacheDir);

  try {
    const nodes = cache.getAllNodes();
    const graphNodes: GraphNode[] = [];
    const graphEdges: GraphEdge[] = [];

    // Build set of existing node IDs for edge filtering
    const existingNodeIds = new Set(nodes.map((n) => n.id));

    // Build node list with degree info
    for (const node of nodes) {
      const centrality = cache.getCentrality(node.id);
      graphNodes.push({
        id: node.id,
        title: node.title,
        inDegree: centrality?.inDegree ?? 0,
      });

      // Build edges from outgoing links, filtering to existing targets only
      for (const target of node.outgoingLinks) {
        if (existingNodeIds.has(target)) {
          graphEdges.push({
            source: node.id,
            target,
          });
        }
      }
    }

    // Generate HTML
    const html = generateHtml(graphNodes, graphEdges);

    // Ensure output directory exists
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, html, 'utf-8');

    return {
      outputPath,
      nodeCount: graphNodes.length,
      edgeCount: graphEdges.length,
      shouldOpen: options.open ?? false,
    };
  } finally {
    cache.close();
  }
}

function generateHtml(nodes: GraphNode[], edges: GraphEdge[]): string {
  const nodesJson = JSON.stringify(nodes);
  const edgesJson = JSON.stringify(edges);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Roux Graph Visualization</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #1a1a2e; overflow: hidden; }
    svg { display: block; width: 100vw; height: 100vh; }
    .node circle { cursor: pointer; }
    .node text { fill: #e0e0e0; font-size: 10px; pointer-events: none; }
    .link { stroke: #4a4a6a; stroke-opacity: 0.6; fill: none; }
    .tooltip {
      position: absolute;
      background: #16213e;
      color: #e0e0e0;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      border: 1px solid #4a4a6a;
    }
  </style>
</head>
<body>
  <div class="tooltip" id="tooltip"></div>
  <svg></svg>
  <script>
    const nodes = ${nodesJson};
    const links = ${edgesJson};

    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = d3.select("svg")
      .attr("viewBox", [0, 0, width, height]);

    const g = svg.append("g");

    // Zoom behavior
    svg.call(d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => g.attr("transform", event.transform)));

    // Node size based on in-degree
    const maxDegree = Math.max(1, ...nodes.map(n => n.inDegree));
    const nodeRadius = d => 5 + (d.inDegree / maxDegree) * 15;

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(d => nodeRadius(d) + 5));

    // Draw links with arrows
    svg.append("defs").append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#4a4a6a")
      .attr("d", "M0,-5L10,0L0,5");

    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", "link")
      .attr("marker-end", "url(#arrow)");

    // Draw nodes
    const node = g.append("g")
      .selectAll(".node")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    node.append("circle")
      .attr("r", nodeRadius)
      .attr("fill", "#0f4c75")
      .attr("stroke", "#3282b8")
      .attr("stroke-width", 2);

    node.append("text")
      .attr("dx", d => nodeRadius(d) + 5)
      .attr("dy", 4)
      .text(d => d.title.length > 20 ? d.title.slice(0, 17) + "..." : d.title);

    // HTML escape function for XSS prevention
    function escapeHtml(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Tooltip
    const tooltip = d3.select("#tooltip");
    node
      .on("mouseover", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(\`<strong>\${escapeHtml(d.title)}</strong><br>ID: \${escapeHtml(d.id)}<br>Incoming links: \${d.inDegree}\`);
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));

    // Simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node.attr("transform", d => \`translate(\${d.x},\${d.y})\`);
    });

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  </script>
</body>
</html>`;
}
