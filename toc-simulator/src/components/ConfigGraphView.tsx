// ConfigGraphView.tsx — SVG node-link diagram for computation graphs
// Renders nodes, edges, accepting paths, heatmap overlays interactively

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type ComputationGraph, type LayoutNode, layoutTree } from '../engine/shared/ConfigGraph';
import { HeatmapStore } from '../engine/shared/HeatmapStore';
// Re-export layoutTree for use from this component
export { layoutTree };

interface Props {
  graph: ComputationGraph;
  activeNodeId?: string;
  showHeatmap?: boolean;
  onNodeClick?: (nodeId: string) => void;
  svgWidth?: number;
  svgHeight?: number;
  nodeSpacingX?: number;
  nodeSpacingY?: number;
}

const STATUS_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  default:   { fill: 'var(--surface)', stroke: 'var(--border)',     text: 'var(--ink)' },
  accepting: { fill: '#16a34a',        stroke: '#14532d',           text: '#fff' },
  rejecting: { fill: '#dc2626',        stroke: '#7f1d1d',           text: '#fff' },
  dead:      { fill: '#6b7280',        stroke: '#374151',           text: '#fff' },
  loop:      { fill: '#d97706',        stroke: '#92400e',           text: '#fff' },
  active:    { fill: 'var(--pda)',     stroke: 'var(--pda-border)', text: '#fff' },
  visited:   { fill: 'var(--bg-2)',    stroke: 'var(--border)',     text: 'var(--ink-2)' },
};

export default function ConfigGraphView({
  graph,
  activeNodeId,
  showHeatmap = false,
  onNodeClick,
  svgWidth = 780,
  svgHeight: svgHeightProp,
  nodeSpacingX = 90,
  nodeSpacingY = 80,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const layoutNodes = useMemo(() =>
    layoutTree(graph, nodeSpacingX, nodeSpacingY, svgWidth),
    [graph, nodeSpacingX, nodeSpacingY, svgWidth]
  );

  const nodeById = useMemo(() => {
    const m = new Map<string, LayoutNode>();
    for (const n of layoutNodes) m.set(n.id, n);
    return m;
  }, [layoutNodes]);

  const maxDepth = Math.max(0, ...layoutNodes.map(n => n.depth));
  const svgHeight = svgHeightProp ?? (maxDepth + 2) * nodeSpacingY + 60;

  const acceptingNodeIds = useMemo(() =>
    new Set(graph.acceptingPaths.flat()),
    [graph.acceptingPaths]
  );

  return (
    <div className="relative overflow-auto" style={{ maxHeight: svgHeight + 20 }}>
      <svg
        width={svgWidth}
        height={svgHeight}
        style={{ overflow: 'visible', display: 'block', minWidth: svgWidth }}
      >
        {/* Edges first (behind nodes) */}
        {graph.edges.map((edge, i) => {
          const from = nodeById.get(edge.from);
          const to = nodeById.get(edge.to);
          if (!from || !to) return null;

          const isAcceptingEdge = acceptingNodeIds.has(edge.from) && acceptingNodeIds.has(edge.to);
          const isHovered = hoveredId === edge.from || hoveredId === edge.to;

          // Midpoint for label
          const mx = (from.x + to.x) / 2;
          const my = (from.y + to.y) / 2;

          return (
            <motion.g key={`edge-${i}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: i * 0.01, duration: 0.3 }}>
              <line
                x1={from.x} y1={from.y + 14}
                x2={to.x}   y2={to.y - 14}
                stroke={isAcceptingEdge ? '#16a34a' : isHovered ? 'var(--ink-2)' : 'var(--border)'}
                strokeWidth={isAcceptingEdge ? 2 : 1.5}
                strokeDasharray={edge.isEpsilon ? '4,3' : undefined}
                markerEnd="url(#arrowhead)"
              />
              {edge.label && (
                <text x={mx} y={my - 4}
                  textAnchor="middle"
                  fontSize="8" fontFamily="JetBrains Mono"
                  fill={isAcceptingEdge ? '#16a34a' : 'var(--ink-3)'}
                  style={{ pointerEvents: 'none' }}>
                  {edge.label.length > 14 ? edge.label.slice(0, 12) + '…' : edge.label}
                </text>
              )}
            </motion.g>
          );
        })}

        {/* Arrow marker */}
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0 0 L6 3 L0 6 Z" fill="var(--border)" />
          </marker>
        </defs>

        {/* Nodes */}
        {layoutNodes.map((node, i) => {
          const colors = STATUS_COLORS[node.status] ?? STATUS_COLORS.default;
          const isActive = node.id === activeNodeId;
          const isHovered = node.id === hoveredId;
          const r = 16;

          return (
            <motion.g
              key={node.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.02, type: 'spring', stiffness: 300, damping: 22 }}
              style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
              onClick={() => onNodeClick?.(node.id)}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Heatmap glow */}
              {showHeatmap && node.heat > 0.05 && (
                <circle
                  cx={node.x} cy={node.y}
                  r={r + 8 + node.heat * 12}
                  fill={HeatmapStore.heatColor(node.heat)}
                  opacity={HeatmapStore.heatAlpha(node.heat)}
                />
              )}

              {/* Active ring */}
              {isActive && (
                <motion.circle cx={node.x} cy={node.y} r={r + 5}
                  fill="none" stroke="var(--pda)" strokeWidth="2"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                />
              )}

              {/* Main circle */}
              <circle
                cx={node.x} cy={node.y} r={r}
                fill={colors.fill}
                stroke={isActive ? 'var(--pda)' : isHovered ? 'var(--ink-2)' : colors.stroke}
                strokeWidth={isActive ? 2.5 : isHovered ? 2 : 1.5}
              />

              {/* Double ring for accepting */}
              {node.status === 'accepting' && (
                <circle cx={node.x} cy={node.y} r={r - 4}
                  fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
              )}

              {/* Node label */}
              <text x={node.x} y={node.y + 4}
                textAnchor="middle"
                fontSize="8" fontFamily="JetBrains Mono" fontWeight="700"
                fill={colors.text}
                style={{ pointerEvents: 'none' }}>
                {node.label.length > 8 ? node.label.slice(0, 7) + '…' : node.label}
              </text>
            </motion.g>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredId && (() => {
          const node = nodeById.get(hoveredId);
          if (!node) return null;
          return (
            <motion.div
              key={hoveredId}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute bottom-2 left-2 right-2 card p-2 z-10 pointer-events-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <p className="text-[10px] font-mono text-[var(--ink-3)] mb-0.5">Step {node.depth} · {node.status}</p>
              <p className="text-xs font-mono text-[var(--ink)] break-all">{node.detail}</p>
              {showHeatmap && node.heat > 0 && (
                <p className="text-[9px] font-mono text-orange-500 mt-0.5">🔥 Heat: {(node.heat * 100).toFixed(0)}%</p>
              )}
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
