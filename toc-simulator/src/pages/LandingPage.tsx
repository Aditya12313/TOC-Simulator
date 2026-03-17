import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';

/* ── Mini CFG Tree Animation ─────────────────────────────── */
function CFGMini() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhase(p => (p + 1) % 3), 1800);
    return () => clearInterval(t);
  }, []);

  const states = [
    { nodes: [{ id: 'S', cx: 60, cy: 18, isNT: true }], edges: [] },
    {
      nodes: [
        { id: 'S', cx: 60, cy: 18, isNT: true },
        { id: 'a', cx: 20, cy: 56, isNT: false },
        { id: 'S', cx: 60, cy: 56, isNT: true },
        { id: 'b', cx: 100, cy: 56, isNT: false },
      ],
      edges: [
        { x1: 60, y1: 26, x2: 20, y2: 48 },
        { x1: 60, y1: 26, x2: 60, y2: 48 },
        { x1: 60, y1: 26, x2: 100, y2: 48 },
      ],
    },
    {
      nodes: [
        { id: 'S', cx: 60, cy: 18, isNT: true },
        { id: 'a', cx: 20, cy: 56, isNT: false },
        { id: 'S', cx: 60, cy: 56, isNT: true },
        { id: 'b', cx: 100, cy: 56, isNT: false },
        { id: 'ε', cx: 60, cy: 92, isNT: false },
      ],
      edges: [
        { x1: 60, y1: 26, x2: 20, y2: 48 },
        { x1: 60, y1: 26, x2: 60, y2: 48 },
        { x1: 60, y1: 26, x2: 100, y2: 48 },
        { x1: 60, y1: 64, x2: 60, y2: 84 },
      ],
    },
  ];
  const cur = states[phase];

  return (
    <svg viewBox="0 0 120 110" width="100" height="92" overflow="visible">
      <AnimatePresence>
        {cur.edges.map((e, i) => (
          <motion.line key={`e-${phase}-${i}`} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke="var(--cfg-border)" strokeWidth="1.8"
            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>
      <AnimatePresence>
        {cur.nodes.map((n, i) => (
          <motion.g key={`n-${phase}-${i}`}
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ delay: i * 0.08, type: 'spring', stiffness: 350, damping: 20 }}>
            <circle cx={n.cx} cy={n.cy} r="11"
              fill={n.isNT ? 'var(--cfg)' : 'var(--cfg-bg)'}
              stroke="var(--cfg-border)" strokeWidth="1.5"/>
            <text x={n.cx} y={n.cy + 4} textAnchor="middle"
              fontSize="8.5" fontFamily="JetBrains Mono" fontWeight="700"
              fill={n.isNT ? 'var(--surface)' : 'var(--cfg)'}>{n.id}</text>
          </motion.g>
        ))}
      </AnimatePresence>
    </svg>
  );
}

/* ── Mini PDA Stack Animation ────────────────────────────── */
function PDAMini() {
  const [stack, setStack] = useState<string[]>(['Z', 'A', 'A']);
  useEffect(() => {
    const frames = [['Z'], ['Z','A'], ['Z','A','A'], ['Z','A','A','A'], ['Z','A','A'], ['Z','A'], ['Z']];
    let i = 0;
    const t = setInterval(() => { i = (i + 1) % frames.length; setStack(frames[i]); }, 600);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ width: 96, height: 92, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
      <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 2, alignItems: 'center' }}>
        <AnimatePresence initial={false}>
          {stack.map((sym, i) => (
            <motion.div key={`${i}`}
              initial={{ height: 0, opacity: 0, scaleY: 0 }}
              animate={{ height: 22, opacity: 1, scaleY: 1 }}
              exit={{ height: 0, opacity: 0, scaleY: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              style={{
                width: 44, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i === stack.length - 1 ? 'var(--pda)' : 'var(--pda-bg)',
                border: `1.5px solid var(--pda-border)`,
                fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 11,
                color: i === stack.length - 1 ? 'var(--surface)' : 'var(--pda)', overflow: 'hidden',
              }}>
              {sym}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Mini TM Tape Animation ──────────────────────────────── */
function TMMini() {
  const [head, setHead] = useState(0);
  const tape = ['_', 'a', 'a', 'b', 'b', '_'];
  useEffect(() => {
    const t = setInterval(() => setHead(h => (h + 1) % tape.length), 550);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ width: 96, height: 92, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <motion.div
        animate={{ x: (head - 2) * 28 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 11, color: 'var(--tm)' }}>
        ▼
      </motion.div>
      <div style={{ display: 'flex' }}>
        {tape.map((sym, i) => (
          <div key={i} style={{
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 12,
            border: `1.5px solid ${i === head ? 'var(--tm)' : 'var(--border)'}`,
            borderRight: i < tape.length - 1 ? 'none' : `1.5px solid ${i === head ? 'var(--tm)' : 'var(--border)'}`,
            background: i === head ? 'var(--tm)' : 'var(--surface)',
            color: i === head ? 'var(--bg)' : 'var(--ink)',
            transition: 'background 0.2s, border-color 0.2s, color 0.2s',
          }}>
            {sym}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Module type ─────────────────────────────────────────── */
type ModuleId = 'cfg' | 'pda' | 'tm';

interface CardProps {
  id: ModuleId;
  label: string;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  path: string;
  delay: number;
  mini: React.ReactNode;
}

/* ── Single Module Card ───────────────────────────────────── */
function ModuleCard({ id, label, title, subtitle, description, features, path, delay, mini }: CardProps) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rotX = useSpring(useTransform(rawY, [-80,  80], [ 8, -8]), { stiffness: 200, damping: 22 });
  const rotY = useSpring(useTransform(rawX, [-100,100], [-10,10]), { stiffness: 200, damping: 22 });

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    rawX.set(e.clientX - r.left - r.width / 2);
    rawY.set(e.clientY - r.top - r.height / 2);
  };
  const onLeave = () => { rawX.set(0); rawY.set(0); };

  // All colors come from CSS variables — dark mode just overrides them
  const accentVar    = `var(--${id})`;
  const accentBgVar  = `var(--${id}-bg)`;
  const accentBdVar  = `var(--${id}-border)`;

  return (
    <motion.div
      ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      onClick={() => navigate(path)}
      initial={{ opacity: 0, y: 44 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 160, damping: 18 }}
      whileHover={{ y: -6 }}
      style={{ rotateX: rotX, rotateY: rotY, transformStyle: 'preserve-3d', perspective: 700, cursor: 'pointer' }}
      className="flex-1 min-w-0"
    >
      <div className="h-full rounded-xl border-2 overflow-hidden flex flex-col"
        style={{
          background: 'var(--surface)',
          borderColor: accentBdVar,
          boxShadow: `4px 4px 0 ${accentBdVar}`,
        }}>

        {/* Card header strip */}
        <div className="px-5 pt-5 pb-4 flex items-start justify-between"
          style={{ background: accentBgVar, borderBottom: `1.5px solid ${accentBdVar}` }}>
          <div className="flex-1 pr-2">
            {/* Label pill — uses CSS-var colors directly */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold font-mono border mb-2"
              style={{ background: accentBgVar, color: accentVar, borderColor: accentBdVar }}>
              {label}
            </span>
            <h3 className="font-black text-lg leading-tight mt-1" style={{ color: 'var(--ink)' }}>{title}</h3>
            <p className="font-mono text-xs mt-1" style={{ color: accentVar }}>{subtitle}</p>
          </div>
          {/* Mini animation */}
          <div style={{ width: 100, height: 92, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {mini}
          </div>
        </div>

        {/* Card body */}
        <div className="px-5 py-4 flex flex-col flex-1">
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--ink-3)' }}>{description}</p>
          <ul className="space-y-2 flex-1">
            {features.map(f => (
              <li key={f} className="flex items-start gap-2 text-xs" style={{ color: 'var(--ink-2)' }}>
                <span className="mt-0.5 font-bold" style={{ color: accentVar }}>›</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <motion.button whileHover={{ x: 5 }} transition={{ type: 'spring', stiffness: 400 }}
            className="mt-4 text-xs font-bold font-mono flex items-center gap-1 self-start"
            style={{ color: accentVar }}>
            Open simulator →
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Landing Page ────────────────────────────────────────── */
export default function LandingPage() {
  const CARDS: Omit<CardProps, 'delay'>[] = [
    {
      id: 'cfg', path: '/cfg', label: 'CFG',
      title: 'Context Free Grammar', subtitle: 'S → aSb | ε',
      description: 'Define production rules and derive strings step-by-step. Detect ambiguity, test membership with CYK, and simplify grammars to CNF.',
      features: ['Leftmost & rightmost derivation', 'Parse tree visualization', 'Grammar simplification / CNF', 'CYK membership test', 'Pumping lemma simulation'],
      mini: <CFGMini />,
    },
    {
      id: 'pda', path: '/pda', label: 'PDA',
      title: 'Pushdown Automata', subtitle: 'δ(q, a, Z) = (q′, AZ)',
      description: 'Model nondeterministic stack machines. Watch every push and pop operation frame-by-frame with full trace of all computation paths.',
      features: ['BFS nondeterminism', 'Animated stack visualization', 'Configuration trace table', 'CFG → PDA conversion', 'Final state & empty stack accept'],
      mini: <PDAMini />,
    },
    {
      id: 'tm', path: '/tm', label: 'TM',
      title: 'Turing Machine', subtitle: 'δ(q, σ) = (q′, σ′, L/R)',
      description: 'Simulate an infinite tape Turing Machine. Animate head movement, detect potential infinite loops, and explore 4 built-in machines.',
      features: ['Animated tape head movement', 'Sliding tape window view', 'Loop / halt detection', '4 built-in examples', 'Accept / Reject / Loop states'],
      mini: <TMMini />,
    },
  ];

  // Formal notation decoration (right side of hero)
  const notations = [
    { text: 'S → aSb | ε',               id: 'cfg' as ModuleId },
    { text: 'δ(q₀, a, Z) = (q₁, AZ)',    id: 'pda' as ModuleId },
    { text: 'δ(q, σ) = (q′, σ′, R)',      id: 'tm'  as ModuleId },
  ];

  return (
    <div className="flex flex-col dot-grid" style={{ height: 'calc(100vh - 48px)', overflow: 'hidden' }}>

      {/* Hero row */}
      <motion.div className="flex items-center justify-between px-10 pt-10 pb-6 shrink-0"
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}>

        <div className="max-w-md">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border font-mono mb-3"
            style={{ background: 'var(--bg-2)', color: 'var(--ink-3)', borderColor: 'var(--border)' }}>
            Computational Playground
          </span>
          <h1 className="text-5xl font-black leading-tight" style={{ color: 'var(--ink)' }}>
            Theory of
            <span className="relative mx-2 inline-block">
              Computation
              <svg className="absolute -bottom-1 left-0 w-full" height="5" viewBox="0 0 260 5" preserveAspectRatio="none">
                <path d="M2 3.5 Q65 1 130 3 Q195 5 258 2" stroke="var(--cfg)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
              </svg>
            </span>
            Lab
          </h1>
          <p className="text-sm mt-4 leading-relaxed max-w-sm" style={{ color: 'var(--ink-3)' }}>
            An interactive simulator for CFG, PDA, and Turing Machines.
            Step through every computation — see exactly how each machine thinks.
          </p>
        </div>

        {/* Notation pills (right side) */}
        <div className="hidden lg:flex flex-col gap-2 items-end">
          {notations.map((n, i) => (
            <motion.div key={n.id}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="px-4 py-2 rounded-lg border font-mono text-sm font-semibold"
              style={{
                background: `var(--${n.id}-bg)`,
                borderColor: `var(--${n.id}-border)`,
                color: `var(--${n.id})`,
              }}>
              {n.text}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Three cards — equal width */}
      <div className="flex-1 px-10 pb-8 overflow-hidden">
        <div className="flex gap-5 h-full">
          {CARDS.map((card, i) => (
            <ModuleCard key={card.path} {...card} delay={0.15 + i * 0.12} />
          ))}
        </div>
      </div>

      {/* Bottom hint */}
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
        className="text-center text-[10px] font-mono pb-3 shrink-0"
        style={{ color: 'var(--ink-3)' }}>
        click any card to open simulator · all engines run locally in your browser
      </motion.p>
    </div>
  );
}
