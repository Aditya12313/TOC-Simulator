// ComplexityChart.tsx — Pure SVG line chart for steps-vs-input-size plots

import { useMemo } from 'react';
import { motion } from 'framer-motion';

export interface DataPoint {
  inputLength: number;
  steps: number;
  label?: string;
}

interface Props {
  data: DataPoint[];
  width?: number;
  height?: number;
  accentColor?: string;
  title?: string;
  xLabel?: string;
  yLabel?: string;
}

export default function ComplexityChart({
  data,
  width = 480,
  height = 240,
  accentColor = 'var(--tm)',
  title = 'Steps vs Input Length',
  xLabel = 'Input Length (n)',
  yLabel = 'Steps',
}: Props) {
  const pad = { top: 24, right: 24, bottom: 44, left: 52 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const { xMin, xMax, yMin, yMax, points, pathD } = useMemo(() => {
    if (data.length === 0) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1, points: [], pathD: '' };

    const xMin = Math.min(...data.map(d => d.inputLength));
    const xMax = Math.max(...data.map(d => d.inputLength));
    const yMin = 0;
    const yMax = Math.max(...data.map(d => d.steps)) * 1.1;

    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;

    const toSVG = (d: DataPoint) => ({
      svgX: pad.left + ((d.inputLength - xMin) / xRange) * innerW,
      svgY: pad.top + innerH - ((d.steps - yMin) / yRange) * innerH,
      ...d,
    });

    const points = data.map(toSVG);
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.svgX} ${p.svgY}`).join(' ');

    return { xMin, xMax, yMin, yMax, points, pathD };
  }, [data, innerW, innerH, pad.left, pad.top]);

  const yTicks = 5;
  const xTicks = Math.min(data.length, 8);

  if (data.length === 0) {
    return (
      <div className="card p-6 text-center text-[var(--ink-3)] text-sm" style={{ width }}>
        No data yet — run the simulation on multiple inputs.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden" style={{ width }}>
      {title && (
        <div className="px-4 py-2 border-b border-[var(--border)]">
          <p className="section-label">{title}</p>
        </div>
      )}
      <svg width={width} height={height} style={{ display: 'block' }}>
        {/* Grid lines */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const ySVG = pad.top + (i / yTicks) * innerH;
          const yValue = yMax - (i / yTicks) * (yMax - yMin);
          return (
            <g key={i}>
              <line x1={pad.left} y1={ySVG} x2={pad.left + innerW} y2={ySVG}
                stroke="var(--border)" strokeWidth="1" strokeDasharray="4,4" />
              <text x={pad.left - 6} y={ySVG + 4}
                textAnchor="end" fontSize="9" fontFamily="JetBrains Mono" fill="var(--ink-3)">
                {yValue.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* X axis */}
        <line x1={pad.left} y1={pad.top + innerH} x2={pad.left + innerW} y2={pad.top + innerH}
          stroke="var(--border)" strokeWidth="1.5" />
        {/* Y axis */}
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + innerH}
          stroke="var(--border)" strokeWidth="1.5" />

        {/* X tick labels */}
        {data.filter((_, i) => i % Math.ceil(data.length / xTicks) === 0).map((d, i) => {
          const svgX = pad.left + ((d.inputLength - xMin) / Math.max(xMax - xMin, 1)) * innerW;
          return (
            <text key={i} x={svgX} y={pad.top + innerH + 14}
              textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fill="var(--ink-3)">
              {d.inputLength}
            </text>
          );
        })}

        {/* Area fill */}
        <motion.path
          d={pathD + ` L ${points[points.length - 1].svgX} ${pad.top + innerH} L ${pad.left} ${pad.top + innerH} Z`}
          fill={accentColor}
          fillOpacity={0.08}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
        />

        {/* Line */}
        <motion.path
          d={pathD}
          fill="none"
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />

        {/* Data points */}
        {points.map((p, i) => (
          <motion.circle key={i}
            cx={p.svgX} cy={p.svgY} r={4}
            fill={accentColor} stroke="var(--surface)" strokeWidth="2"
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.4 + i * 0.06, type: 'spring', stiffness: 300 }}
          >
            <title>{`n=${p.inputLength}: ${p.steps} steps${p.label ? ` (${p.label})` : ''}`}</title>
          </motion.circle>
        ))}

        {/* Axis labels */}
        <text x={pad.left + innerW / 2} y={height - 6}
          textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fill="var(--ink-3)">
          {xLabel}
        </text>
        <text x={12} y={pad.top + innerH / 2}
          textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fill="var(--ink-3)"
          transform={`rotate(-90, 12, ${pad.top + innerH / 2})`}>
          {yLabel}
        </text>
      </svg>
    </div>
  );
}
