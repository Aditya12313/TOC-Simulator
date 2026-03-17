import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

/* ── Mini CFG Tree Animation ─────────────────────────────── */
function CFGMini() {
  const nodes = [
    { id: 'S', x: 60, y: 12, delay: 0 },
    { id: 'a', x: 20, y: 48, delay: 0.2 },
    { id: 'S', x: 60, y: 48, delay: 0.35 },
    { id: 'b', x: 100, y: 48, delay: 0.2 },
    { id: 'a', x: 40, y: 84, delay: 0.5 },
    { id: 'ε', x: 60, y: 84, delay: 0.6 },
    { id: 'b', x: 80, y: 84, delay: 0.5 },
  ];
  const edges = [
    { x1: 64, y1: 20, x2: 24, y2: 44 },
    { x1: 64, y1: 20, x2: 64, y2: 44 },
    { x1: 64, y1: 20, x2: 104, y2: 44 },
    { x1: 64, y1: 56, x2: 44, y2: 80 },
    { x1: 64, y1: 56, x2: 64, y2: 80 },
    { x1: 64, y1: 56, x2: 84, y2: 80 },
  ];
  return (
    <svg viewBox="0 0 124 96" width="124" height="96">
      {edges.map((e, i) => (
        <motion.line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
          stroke="#86efac" strokeWidth="1.5"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.1 * i, duration: 0.4 }}
        />
      ))}
      {nodes.map((n, i) => (
        <motion.g key={i} initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: n.delay, type: 'spring', stiffness: 300 }}>
          <circle cx={n.x + 4} cy={n.y + 4} r="10"
            fill={n.id === 'S' ? '#16a34a' : '#dcfce7'} stroke="#86efac" strokeWidth="1.5"/>
          <text x={n.x + 4} y={n.y + 8} textAnchor="middle"
            fontSize="8" fontFamily="JetBrains Mono" fontWeight="700"
            fill={n.id === 'S' ? '#fff' : '#15803d'}>{n.id}</text>
        </motion.g>
      ))}
    </svg>
  );
}

/* ── Mini PDA Stack Animation ────────────────────────────── */
function PDAMini() {
  const [stack, setStack] = useState<string[]>(['Z', 'A', 'A', 'A']);
  useEffect(() => {
    const frames = [
      ['Z', 'A', 'A', 'A'],
      ['Z', 'A', 'A'],
      ['Z', 'A'],
      ['Z'],
      ['Z', 'A'],
      ['Z', 'A', 'A'],
      ['Z', 'A', 'A', 'A'],
    ];
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % frames.length;
      setStack(frames[i]);
    }, 700);
    return () => clearInterval(t);
  }, []);

  const colors: Record<string, string> = { Z: '#ea580c', A: '#fed7aa' };
  const textColors: Record<string, string> = { Z: '#fff', A: '#9a3412' };

  return (
    <div className="flex flex-col-reverse items-center gap-1 h-20 justify-end">
      {stack.map((sym, i) => (
        <motion.div key={`${sym}-${i}`}
          initial={{ opacity: 0, y: -10, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="w-12 h-7 flex items-center justify-center rounded border font-mono text-xs font-bold"
          style={{
            background: colors[sym] ?? '#fed7aa',
            borderColor: '#fdba74',
            color: textColors[sym] ?? '#9a3412',
          }}>
          {sym}
        </motion.div>
      ))}
    </div>
  );
}

/* ── Mini TM Tape Animation ──────────────────────────────── */
function TMMini() {
  const [head, setHead] = useState(2);
  const tape = ['_', 'a', 'b', 'a', '_'];
  useEffect(() => {
    const t = setInterval(() => setHead(h => (h + 1) % tape.length), 650);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        animate={{ x: (head - 2) * 34 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="text-xs font-mono font-bold"
        style={{ color: 'var(--tm)' }}>▼</motion.div>
      <div className="flex">
        {tape.map((sym, i) => (
          <div key={i}
            className="w-8 h-8 flex items-center justify-center border font-mono text-xs font-bold"
            style={{
              borderRight: i < tape.length - 1 ? 'none' : '1.5px solid var(--border)',
              borderTop: '1.5px solid var(--border)',
              borderBottom: '1.5px solid var(--border)',
              borderLeft: '1.5px solid var(--border)',
              background: i === head ? 'var(--tm)' : 'var(--surface)',
              color: i === head ? '#fff' : 'var(--ink)',
              transition: 'background 0.2s, color 0.2s',
            }}>
            {sym}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Floating Module Node ────────────────────────────────── */
interface NodeProps {
  title: string;
  subtitle: string;
  label: string;
  tagClass: string;
  accent: string;
  accentLight: string;
  accentBorder: string;
  description: string;
  feats: string[];
  path: string;
  mini: React.ReactNode;
  style: React.CSSProperties;
}

function ModuleNode({
  title, subtitle, label, tagClass, accent, accentLight, accentBorder,
  description, feats, path, mini, style,
}: NodeProps) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-60, 60], [6, -6]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(x, [-80, 80], [-8, 8]), { stiffness: 200, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    x.set(e.clientX - rect.left - rect.width / 2);
    y.set(e.clientY - rect.top - rect.height / 2);
  };
  const handleMouseLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => navigate(path)}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
      whileHover={{ scale: 1.03 }}
      style={{
        ...style,
        rotateX: rx,
        rotateY: ry,
        perspective: 600,
        transformStyle: 'preserve-3d',
        cursor: 'pointer',
        position: 'absolute',
      }}
    >
      <div
        className="w-64 rounded-xl border-2 overflow-hidden"
        style={{
          background: 'var(--surface)',
          borderColor: accentBorder,
          boxShadow: `5px 5px 0 ${accentBorder}`,
        }}
      >
        {/* Header strip */}
        <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2"
          style={{ background: accentLight, borderBottom: `1.5px solid ${accentBorder}` }}>
          <div>
            <span className={`pill ${tagClass} text-xs mb-1`}>{label}</span>
            <h3 className="font-black text-base text-[var(--ink)] leading-tight mt-1">{title}</h3>
            <p className="font-mono text-xs mt-0.5" style={{ color: accent }}>{subtitle}</p>
          </div>
          <motion.div
            animate={{ rotate: [0, 3, -3, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          >
            {mini}
          </motion.div>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          <p className="text-xs text-[var(--ink-3)] leading-relaxed mb-3">{description}</p>
          <ul className="space-y-1">
            {feats.map(f => (
              <li key={f} className="flex items-center gap-1.5 text-xs text-[var(--ink-2)]">
                <span style={{ color: accent }}>›</span> {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer CTA */}
        <div className="px-4 pb-4">
          <motion.button
            whileHover={{ x: 4 }}
            className="text-xs font-bold font-mono flex items-center gap-1"
            style={{ color: accent }}
          >
            Open simulator →
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Landing Page ────────────────────────────────────────── */
export default function LandingPage() {
  const NODES: Omit<NodeProps, 'style'>[] = [
    {
      path: '/cfg',
      label: 'CFG',
      title: 'Context Free Grammar',
      subtitle: 'Derivations & Parse Trees',
      accent: '#16a34a',
      accentLight: '#f0fdf4',
      accentBorder: '#86efac',
      tagClass: 'pill-cfg',
      description: 'Define production rules, derive strings leftmost or rightmost, detect ambiguity, and simplify to CNF.',
      feats: ['Leftmost / Rightmost derivation', 'Parse tree visualization', 'CYK membership test', 'Grammar → CNF'],
      mini: <CFGMini />,
    },
    {
      path: '/pda',
      label: 'PDA',
      title: 'Pushdown Automata',
      subtitle: 'Stack-based Computation',
      accent: '#ea580c',
      accentLight: '#fff7ed',
      accentBorder: '#fdba74',
      tagClass: 'pill-pda',
      description: 'Model nondeterministic stack machines. Watch push/pop operations frame-by-frame and trace all paths.',
      feats: ['BFS nondeterminism', 'Animated stack viz', 'Trace table', 'CFG → PDA conversion'],
      mini: <PDAMini />,
    },
    {
      path: '/tm',
      label: 'TM',
      title: 'Turing Machine',
      subtitle: 'Infinite Tape Computation',
      accent: '#e11d48',
      accentLight: '#fff1f2',
      accentBorder: '#fda4af',
      tagClass: 'pill-tm',
      description: 'Simulate an infinite tape TM. Animate head movement, detect loops, and run 4 built-in machines.',
      feats: ['Animated tape head', 'Loop detection', '4 built-in examples', 'Accept / Reject / Halt'],
      mini: <TMMini />,
    },
  ];

  // Positions: asymmetric layout on a canvas
  const positions: React.CSSProperties[] = [
    { top: '12%',  left: '8%' },
    { top: '28%',  left: '37%' },
    { top: '10%',  right: '6%' },
  ];

  return (
    <div className="relative w-full dot-grid overflow-hidden" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Hero text — top left */}
      <motion.div
        className="absolute top-8 left-10 z-10 max-w-xs"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <div className="pill pill-gray mb-3">Computational Playground</div>
        <h1 className="text-4xl font-black leading-tight text-[var(--ink)]">
          Theory of<br />
          <span className="relative inline-block">
            Computation
            {/* hand-underline */}
            <svg className="absolute -bottom-1 left-0 w-full" height="6" viewBox="0 0 200 6" preserveAspectRatio="none">
              <path d="M2 4 Q50 1 100 3 Q150 5 198 2" stroke="#16a34a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            </svg>
          </span>
          <br />Lab
        </h1>
        <p className="text-sm text-[var(--ink-3)] mt-3 leading-relaxed">
          Choose a computational model below. Simulate step-by-step and understand every transition.
        </p>
      </motion.div>

      {/* Floating nodes */}
      {NODES.map((n, i) => (
        <ModuleNode key={n.path} {...n} style={positions[i]} />
      ))}

      {/* Bottom label */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs font-mono text-[var(--ink-3)] text-center"
      >
        click any card to enter ·&nbsp;
        <span className="opacity-50">all simulation engines run in your browser</span>
      </motion.p>

      {/* Decorative connecting lines (SVG watermark) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10" style={{ zIndex: 0 }}>
        <line x1="30%" y1="35%" x2="42%" y2="45%" stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="4 4"/>
        <line x1="63%" y1="35%" x2="58%" y2="45%" stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="4 4"/>
      </svg>
    </div>
  );
}
