// Shared Configuration Graph types and utilities
// Used by CFG, PDA, and TM simulators for computation path visualization

export type NodeStatus = 'default' | 'accepting' | 'rejecting' | 'dead' | 'loop' | 'active' | 'visited';

export interface GraphNode {
  id: string;
  label: string;          // Short display label
  detail: string;         // Full configuration string
  status: NodeStatus;
  depth: number;          // Level in computation tree
  heat: number;           // 0–1 visit frequency (for heatmap)
  meta?: Record<string, unknown>; // Engine-specific extra data
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;          // Transition label
  isEpsilon?: boolean;
  isHighlighted?: boolean; // Part of accepting path
}

export interface ComputationGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  acceptingPaths: string[][]; // Arrays of node IDs forming accepting paths
  rootId: string;
}

// Build a flat graph from a tree structure (DFS)
export function flattenTree<T extends {
  id: string;
  children: T[];
  isAccepting: boolean;
  isDead: boolean;
  isLoop: boolean;
  stepNum: number;
}>(
  root: T,
  nodeMapper: (node: T) => Omit<GraphNode, 'id' | 'status' | 'depth' | 'heat'>,
  edgeMapper: (parent: T, child: T) => string,
  maxNodes = 300
): ComputationGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const acceptingPaths: string[][] = [];
  const nodeCount = { count: 0 };

  function getStatus(n: T): NodeStatus {
    if (n.isAccepting) return 'accepting';
    if (n.isLoop) return 'loop';
    if (n.isDead) return 'dead';
    return 'default';
  }

  function traverse(node: T, depth: number, path: string[]): void {
    if (nodeCount.count >= maxNodes) return;
    nodeCount.count++;

    const mapped = nodeMapper(node);
    nodes.push({
      ...mapped,
      id: node.id,
      status: getStatus(node),
      depth,
      heat: 0,
    });

    const currentPath = [...path, node.id];
    if (node.isAccepting) {
      acceptingPaths.push([...currentPath]);
    }

    for (const child of node.children) {
      if (nodeCount.count >= maxNodes) break;
      const edgeLabel = edgeMapper(node, child);
      edges.push({
        from: node.id,
        to: child.id,
        label: edgeLabel,
        isHighlighted: false,
      });
      traverse(child, depth + 1, currentPath);
    }
  }

  traverse(root, 0, []);

  // Mark accepting path edges
  const acceptingNodeIds = new Set(acceptingPaths.flat());
  for (const edge of edges) {
    if (acceptingNodeIds.has(edge.from) && acceptingNodeIds.has(edge.to)) {
      edge.isHighlighted = true;
    }
  }

  return { nodes, edges, acceptingPaths, rootId: root.id };
}

// Compute heatmap frequencies from visited node IDs
export function applyHeatmap(
  graph: ComputationGraph,
  visitedIds: string[]
): ComputationGraph {
  const freq = new Map<string, number>();
  for (const id of visitedIds) freq.set(id, (freq.get(id) ?? 0) + 1);
  const maxFreq = Math.max(1, ...freq.values());

  const nodes = graph.nodes.map(n => ({
    ...n,
    heat: (freq.get(n.id) ?? 0) / maxFreq,
  }));
  return { ...graph, nodes };
}

// Get all ancestor IDs for a given node (for path highlighting)
export function getAncestors(graph: ComputationGraph, nodeId: string): Set<string> {
  const parentMap = new Map<string, string>();
  for (const edge of graph.edges) {
    parentMap.set(edge.to, edge.from);
  }
  const ancestors = new Set<string>();
  let cur = nodeId;
  while (parentMap.has(cur)) {
    cur = parentMap.get(cur)!;
    ancestors.add(cur);
  }
  return ancestors;
}

// Layout nodes in a tree arrangement (simple layered layout)
export interface LayoutNode extends GraphNode {
  x: number;
  y: number;
}

export function layoutTree(
  graph: ComputationGraph,
  nodeSpacingX = 90,
  nodeSpacingY = 80,
  svgWidth = 800
): LayoutNode[] {
  // Group nodes by depth
  const byDepth = new Map<number, GraphNode[]>();
  for (const n of graph.nodes) {
    const existing = byDepth.get(n.depth) ?? [];
    existing.push(n);
    byDepth.set(n.depth, existing);
  }

  const maxDepth = Math.max(...byDepth.keys(), 0);
  const layoutNodes: LayoutNode[] = [];

  for (let depth = 0; depth <= maxDepth; depth++) {
    const row = byDepth.get(depth) ?? [];
    const totalWidth = (row.length - 1) * nodeSpacingX;
    const startX = Math.max(nodeSpacingX, (svgWidth - totalWidth) / 2);
    row.forEach((n, i) => {
      layoutNodes.push({ ...n, x: startX + i * nodeSpacingX, y: depth * nodeSpacingY + 40 });
    });
  }

  return layoutNodes;
}
