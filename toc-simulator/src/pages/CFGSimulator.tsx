import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw, BookOpen, ChevronRight, TreePine, Diff, Wrench,
  FlaskConical, Gauge, Shuffle, GitBranch, Scale, GraduationCap,
} from 'lucide-react';
import {
  parseGrammar, deriveLeftmost, deriveRightmost, cykFull, cykMembership,
  detectAmbiguity, simplifyGrammar, simulatePumpingLemma, buildParseTree,
  generateRandomString, getDerivationPaths, grammarEquivalenceHeuristic,
  buildPumpingLemmaProofSteps, AMBIGUITY_EXAMPLES,
  type ParseTreeNode, type DerivationStep, type CYKCell,
} from '../engine/cfg/CFGEngine';
import PlaybackBar from '../components/PlaybackBar';
import ProofBuilder, { type ProofStep } from '../components/ProofBuilder';

const EXAMPLES = [
  { name: 'aⁿbⁿ',       rules: 'S -> aSb | ε', start: 'S', input: 'aabb',  desc: 'Equal a\'s and b\'s' },
  { name: 'Matching ()', rules: 'S -> SS | (S) | ε', start: 'S', input: '(())', desc: 'Balanced parens' },
  { name: 'Arithmetic', rules: 'E -> E+T | T\nT -> T*F | F\nF -> (E) | a', start: 'E', input: 'a+a*a', desc: 'Expr grammar' },
  { name: 'Ambiguous',  rules: 'S -> S+S | S*S | a', start: 'S', input: 'a+a*a', desc: 'No precedence' },
];

type Mode = 'derivation' | 'parse-tree' | 'cyk' | 'ambiguity' | 'simplify' | 'membership' | 'multi-path' | 'random-gen' | 'equivalence' | 'proof' | 'pumping';

const MODES: { id: Mode; label: string; icon: React.ReactNode; group?: string }[] = [
  { id: 'derivation',  label: 'Derivation',    icon: <ChevronRight size={12}/>,  group: 'Core' },
  { id: 'parse-tree',  label: 'Parse Tree',    icon: <TreePine size={12}/>,      group: 'Core' },
  { id: 'membership',  label: 'Membership',    icon: <Gauge size={12}/>,         group: 'Core' },
  { id: 'cyk',         label: 'CYK Table',     icon: <Scale size={12}/>,         group: 'Analysis' },
  { id: 'ambiguity',   label: 'Ambiguity',     icon: <Diff size={12}/>,          group: 'Analysis' },
  { id: 'simplify',    label: 'CNF/Simplify',  icon: <Wrench size={12}/>,        group: 'Analysis' },
  { id: 'multi-path',  label: 'Multi-Path',    icon: <GitBranch size={12}/>,     group: 'Advanced' },
  { id: 'random-gen',  label: 'Random Gen',    icon: <Shuffle size={12}/>,       group: 'Advanced' },
  { id: 'equivalence', label: 'Equivalence',   icon: <Scale size={12}/>,         group: 'Advanced' },
  { id: 'proof',       label: 'Proof Mode',    icon: <GraduationCap size={12}/>, group: 'Learning' },
  { id: 'pumping',     label: 'Pumping Lemma', icon: <FlaskConical size={12}/>,  group: 'Learning' },
];

/* ── SVG Parse Tree ──────────────────────────────────────── */
function TreeNode({ node, depth = 0, x = 0, y = 0, spread = 120 }:
  { node: ParseTreeNode; depth?: number; x?: number; y?: number; spread?: number }) {
  const cols = ['#16a34a', '#ea580c', '#e11d48', '#7c3aed', '#0284c7'];
  const c = cols[depth % cols.length];
  const childCount = node.children.length;
  const childSpread = Math.max(32, spread / Math.max(childCount, 1));
  const startX = x - ((childCount - 1) * childSpread) / 2;
  return (
    <g>
      {node.children.map((child, i) => {
        const cx = startX + i * childSpread;
        const cy = y + 56;
        return (
          <g key={i}>
            <motion.line x1={x} y1={y + 9} x2={cx} y2={cy - 9}
              stroke="#d6cfc3" strokeWidth="1.5"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: depth * 0.15 }} />
            <TreeNode node={child} depth={depth + 1} x={cx} y={cy} spread={childSpread * 0.9} />
          </g>
        );
      })}
      <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: depth * 0.15, type: 'spring', stiffness: 300 }}>
        <circle cx={x} cy={y} r="14" fill={node.isTerminal ? '#faf8f4' : c} stroke={c} strokeWidth="1.5"/>
        <text x={x} y={y + 4} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono"
          fontWeight="700" fill={node.isTerminal ? c : '#fff'}>{node.symbol}</text>
      </motion.g>
    </g>
  );
}

/* ── CYK Grid ──────────────────────────────────────────────── */
function CYKGrid({ cells, input, startSymbol }: { cells: CYKCell[][]; input: string; startSymbol: string }) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const n = cells.length;
  if (n === 0) return null;

  return (
    <div className="overflow-x-auto">
      <p className="section-label mb-3">CYK Parse Table (row i, col j = NTs deriving input[i..j])</p>
      {/* Header: input characters */}
      <div style={{ display: 'grid', gridTemplateColumns: `40px repeat(${n}, 1fr)`, gap: 2, maxWidth: 600 }}>
        <div />
        {input.split('').map((ch, j) => (
          <div key={j} className="text-center font-mono text-xs font-bold py-1" style={{ color: 'var(--cfg)' }}>
            {j}<br/><span className="text-[var(--ink-3)]">{ch}</span>
          </div>
        ))}
        {/* Grid cells: lower-triangular (i ≤ j) */}
        {cells.map((row, i) => (
          <>
            <div key={`row-${i}`} className="font-mono text-xs font-bold flex items-center justify-center"
              style={{ color: 'var(--ink-3)' }}>{i}</div>
            {row.map((cell, j) => {
              const isValid = j >= i;
              const isAcceptCell = i === 0 && j === n - 1;
              const hasStart = cell.nonterminals.includes(startSymbol);
              const key = `${i},${j}`;
              const isHovered = hoveredCell === key;
              return (
                <motion.div key={j}
                  onMouseEnter={() => isValid ? setHoveredCell(key) : null}
                  onMouseLeave={() => setHoveredCell(null)}
                  initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: (i * n + j) * 0.015 }}
                  className="rounded-lg p-1 text-center min-h-10 flex flex-col items-center justify-center cursor-default"
                  style={{
                    background: !isValid ? 'transparent' :
                      isAcceptCell && hasStart ? 'rgba(22,163,74,0.2)' :
                      isHovered ? 'var(--bg-2)' : 'var(--surface)',
                    border: !isValid ? 'none' :
                      isAcceptCell ? '2px solid var(--cfg)' : '1px solid var(--border)',
                    opacity: !isValid ? 0 : 1,
                  }}>
                  {isValid && (
                    <>
                      {cell.nonterminals.length > 0 ? (
                        <span className="font-mono text-[10px] font-bold" style={{
                          color: hasStart ? 'var(--cfg)' : 'var(--ink)',
                        }}>
                          {cell.nonterminals.join(',')}
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] text-[var(--ink-3)]">∅</span>
                      )}
                    </>
                  )}
                </motion.div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

export default function CFGSimulator() {
  const [rules, setRules]   = useState('S -> aSb | ε');
  const [start, setStart]   = useState('S');
  const [input, setInput]   = useState('aabb');
  const [mode, setMode]     = useState<Mode>('derivation');
  const [derivType, setDerivType] = useState<'leftmost'|'rightmost'>('leftmost');
  const [pumpLen, setPumpLen] = useState(3);
  const [errors, setErrors] = useState<string[]>([]);

  // Derivation state
  const [steps, setSteps]   = useState<DerivationStep[]>([]);
  const [curStep, setCurStep] = useState(-1);
  const [speed, setSpeed]   = useState(2);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [treeRoot, setTreeRoot] = useState<ParseTreeNode | null>(null);

  // Mode-specific states
  const [ambData, setAmbData] = useState<ReturnType<typeof detectAmbiguity> | null>(null);
  const [simplData, setSimplData] = useState<ReturnType<typeof simplifyGrammar>>([]);
  const [simplIdx, setSimplIdx]   = useState(0);
  const [cykData, setCykData]     = useState<{ cells: CYKCell[][]; accepted: boolean; explanation: string[] } | null>(null);
  const [pumpData, setPumpData]   = useState<ReturnType<typeof simulatePumpingLemma> | null>(null);
  const [multiPaths, setMultiPaths] = useState<ReturnType<typeof getDerivationPaths>>([]);
  const [selectedPath, setSelectedPath] = useState(0);
  const [randomResult, setRandomResult] = useState<ReturnType<typeof generateRandomString> | null>(null);
  const [equivG2, setEquivG2] = useState('S -> aSb | S | ε');
  const [equivG2Start, setEquivG2Start] = useState('S');
  const [equivResult, setEquivResult] = useState<ReturnType<typeof grammarEquivalenceHeuristic> | null>(null);
  const [proofSteps, setProofSteps] = useState<ProofStep[]>([]);
  const [proofKey, setProofKey] = useState(0); // Force re-render ProofBuilder
  const [guidedHint, setGuidedHint] = useState('');
  const [ambExampleIdx, setAmbExampleIdx] = useState(0);

  const autoRef = useRef<number|null>(null);
  const logRef  = useRef<HTMLDivElement>(null);
  const speedMs = [1200, 650, 220][speed - 1];

  const stopAuto = () => { if (autoRef.current) clearInterval(autoRef.current); setIsRunning(false); };
  const resetAll = useCallback(() => {
    stopAuto(); setSteps([]); setCurStep(-1); setResult(null); setTreeRoot(null);
    setAmbData(null); setSimplData([]); setCykData(null); setPumpData(null);
    setErrors([]); setGuidedHint(''); setMultiPaths([]); setRandomResult(null); setEquivResult(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSim = useCallback(() => {
    resetAll();
    const { grammar, errors: ge } = parseGrammar(rules, start);
    if (ge.length) { setErrors(ge); return; }

    if (mode === 'derivation') {
      const fn = derivType === 'leftmost' ? deriveLeftmost : deriveRightmost;
      const { steps: s, success, message } = fn(grammar, input);
      setSteps(s); setResult({ ok: success, msg: message });
      if (success) setTreeRoot(buildParseTree(grammar, s));
    } else if (mode === 'parse-tree') {
      const { steps: s, success, message } = deriveLeftmost(grammar, input);
      setSteps(s); setResult({ ok: success, msg: message });
      if (success) setTreeRoot(buildParseTree(grammar, s));
    } else if (mode === 'ambiguity') {
      setAmbData(detectAmbiguity(grammar, input));
    } else if (mode === 'simplify') {
      setSimplData(simplifyGrammar(grammar)); setSimplIdx(0);
    } else if (mode === 'membership') {
      const r = cykMembership(grammar, input);
      setCykData({ cells: [], accepted: r.accepted, explanation: r.explanation });
    } else if (mode === 'cyk') {
      const r = cykFull(grammar, input);
      setCykData({ cells: r.cells, accepted: r.accepted, explanation: r.explanation });
    } else if (mode === 'pumping') {
      setPumpData(simulatePumpingLemma(grammar, input, pumpLen));
    } else if (mode === 'multi-path') {
      const paths = getDerivationPaths(grammar, input, 8, 80);
      setMultiPaths(paths); setSelectedPath(0);
      setResult({ ok: paths.length > 0, msg: paths.length > 0 ? `Found ${paths.length} derivation path(s)` : 'No derivation found.' });
    } else if (mode === 'random-gen') {
      const gen = generateRandomString(grammar, 8, 200);
      setRandomResult(gen);
    } else if (mode === 'equivalence') {
      const { grammar: g2, errors: ge2 } = parseGrammar(equivG2, equivG2Start);
      if (ge2.length) { setErrors(ge2); return; }
      const r = grammarEquivalenceHeuristic(grammar, g2, 40);
      setEquivResult(r);
    } else if (mode === 'proof') {
      const rawSteps = buildPumpingLemmaProofSteps(grammar, input, pumpLen);
      const adapted: ProofStep[] = rawSteps.map(s => ({
        id: s.id,
        title: s.title,
        description: s.description,
        hint: s.hint,
        isInfo: s.isInfo,
        infoContent: s.infoContent,
        inputPlaceholder: s.inputPlaceholder,
        inputType: s.inputType,
        validate: s.validate
          ? (userInput: string, _ctx) => {
              const res = s.validate!(userInput, {});
              return { valid: res.valid, message: res.message, explanation: res.explanation };
            }
          : undefined,
      }));
      setProofSteps(adapted);
      setProofKey(k => k + 1);
    }
    setCurStep(-1);
  }, [rules, start, input, mode, derivType, pumpLen, equivG2, equivG2Start, resetAll]);

  // Auto-play
  const togglePlay = useCallback(() => {
    if (isRunning) { stopAuto(); return; }
    setIsRunning(true);
    autoRef.current = window.setInterval(() => {
      setCurStep(p => {
        if (p >= steps.length - 1) { stopAuto(); return p; }
        return p + 1;
      });
    }, speedMs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, steps.length, speedMs]);

  useEffect(() => { if (curStep >= 0 && steps[curStep]) setGuidedHint(steps[curStep].explanation); }, [curStep, steps]);
  useEffect(() => () => stopAuto(), []);

  useEffect(() => {
    if (logRef.current && curStep >= 0) {
      const el = logRef.current.querySelector(`[data-step="${curStep}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [curStep]);

  const displaySent = curStep === -1 ? start : (steps[curStep]?.sentential ?? start);
  const rulesDisplay = (r: { lhs: string; rhs: string[] }[]) =>
    r.map(x => `${x.lhs} → ${x.rhs.map(p => p||'ε').join(' | ')}`).join('\n');
  const isShaking = result && !result.ok;

  // Group modes for tab display
  const modeGroups = useMemo(() => {
    const groups: Record<string, typeof MODES> = {};
    for (const m of MODES) {
      const g = m.group ?? 'Other';
      groups[g] = groups[g] ?? [];
      groups[g].push(m);
    }
    return groups;
  }, []);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Mode tabs */}
      <div className="border-b border-[var(--border)] px-4 py-2 flex items-center gap-2 overflow-x-auto"
        style={{ background: 'var(--surface)' }}>
        <span className="pill pill-cfg shrink-0">CFG</span>
        <span className="w-px h-4 bg-[var(--border)] shrink-0" />
        {Object.entries(modeGroups).map(([group, modes]) => (
          <div key={group} className="flex items-center gap-1 shrink-0">
            <span className="text-[9px] uppercase font-bold text-[var(--ink-3)] tracking-widest mr-1">{group}</span>
            {modes.map(m => (
              <button key={m.id} onClick={() => { setMode(m.id); resetAll(); }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all duration-150 shrink-0 ${
                  mode === m.id
                    ? 'bg-[var(--cfg-bg)] text-[var(--cfg)] border-[var(--cfg-border)]'
                    : 'border-transparent text-[var(--ink-3)] hover:border-[var(--border)] hover:text-[var(--ink)]'
                }`}>
                {m.icon} {m.label}
              </button>
            ))}
            <span className="w-px h-4 bg-[var(--border)] ml-1" />
          </div>
        ))}
      </div>

      {/* 3-panel workspace */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Input Panel ─────────────────────────────── */}
        <div className="w-64 border-r border-[var(--border)] flex flex-col overflow-y-auto shrink-0"
          style={{ background: 'var(--bg-2)' }}>
          {/* Examples */}
          <div className="p-3 border-b border-[var(--border)]">
            <div className="section-label flex items-center gap-1"><BookOpen size={10}/> Examples</div>
            <div className="space-y-1">
              {EXAMPLES.map(ex => (
                <button key={ex.name} onClick={() => { setRules(ex.rules); setStart(ex.start); setInput(ex.input); resetAll(); }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface)] border border-transparent hover:border-[var(--border)] transition-all text-xs">
                  <div className="font-semibold text-[var(--ink)]">{ex.name}</div>
                  <div className="text-[var(--ink-3)] mt-0.5 font-mono text-[10px]">{ex.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Grammar inputs */}
          <div className="p-3 space-y-3 flex-1">
            <div>
              <div className="section-label">Production Rules</div>
              <textarea className="code-input h-28" value={rules} onChange={e => setRules(e.target.value)}
                placeholder="S -> aSb | ε"/>
              <p className="text-[10px] text-[var(--ink-3)] mt-1 font-mono">Use | for alternatives, ε for empty</p>
            </div>
            <div>
              <div className="section-label">Start Symbol</div>
              <input className="code-input-field" value={start} onChange={e => setStart(e.target.value)}/>
            </div>

            {/* Formal config display */}
            {start && (
              <div className="px-2.5 py-2 rounded-lg border border-[var(--cfg-border)] bg-[var(--cfg-bg)] font-mono text-[10px]" style={{ color: 'var(--cfg)' }}>
                <span className="text-[var(--ink-3)]">Current form: </span>
                <span className="font-bold">{displaySent || '∅'}</span>
              </div>
            )}

            {/* Mode-specific controls */}
            {(mode === 'derivation') && (
              <div>
                <div className="section-label">Derivation Type</div>
                <div className="flex gap-1.5">
                  {(['leftmost','rightmost'] as const).map(t => (
                    <button key={t} onClick={() => setDerivType(t)}
                      className={`flex-1 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                        derivType === t ? 'bg-[var(--cfg-bg)] text-[var(--cfg)] border-[var(--cfg-border)]' : 'border-[var(--border)] text-[var(--ink-3)]'
                      }`}>{t}</button>
                  ))}
                </div>
              </div>
            )}

            {(mode === 'derivation' || mode === 'parse-tree' || mode === 'ambiguity' || mode === 'membership' || mode === 'cyk' || mode === 'multi-path' || mode === 'proof') && (
              <div>
                <div className="section-label">Input String</div>
                <input className="code-input-field" value={input} onChange={e => setInput(e.target.value)} placeholder="aabb"/>
              </div>
            )}

            {mode === 'pumping' && (
              <>
                <div>
                  <div className="section-label">Input String</div>
                  <input className="code-input-field" value={input} onChange={e => setInput(e.target.value)} placeholder="aabb"/>
                </div>
                <div>
                  <div className="section-label">Pumping Length (p)</div>
                  <input type="number" className="code-input-field" value={pumpLen}
                    onChange={e => setPumpLen(+e.target.value)} min={1} max={20}/>
                </div>
              </>
            )}

            {mode === 'equivalence' && (
              <>
                <div className="border-t border-[var(--border)] pt-3">
                  <div className="section-label">Grammar G2 Rules</div>
                  <textarea className="code-input h-20 resize-none" value={equivG2} onChange={e => setEquivG2(e.target.value)}/>
                </div>
                <div>
                  <div className="section-label">G2 Start Symbol</div>
                  <input className="code-input-field" value={equivG2Start} onChange={e => setEquivG2Start(e.target.value)}/>
                </div>
              </>
            )}

            {errors.length > 0 && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 font-mono space-y-0.5">
                {errors.map((e,i) => <p key={i}>{e}</p>)}
              </div>
            )}
            <button onClick={runSim} className="btn-cfg w-full justify-center">
              ▶ {mode === 'random-gen' ? 'Generate String' : mode === 'proof' ? 'Start Proof' : 'Run Simulation'}
            </button>
            <button onClick={resetAll} className="btn-outline w-full justify-center">
              <RotateCcw size={12}/> Reset
            </button>
          </div>
        </div>

        {/* ── CENTER: Stage ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-5 dot-grid">

            {/* ── DERIVATION ── */}
            {mode === 'derivation' && (
              <div className="space-y-4">
                <div className="card p-5 text-center min-h-24 flex flex-col items-center justify-center">
                  <p className="section-label mb-1">Formal Sentential Form</p>
                  <p className="text-[10px] font-mono text-[var(--ink-3)] mb-2">
                    ({derivType} derivation · step {curStep + 1}/{steps.length})
                  </p>
                  <motion.div key={displaySent}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className={`text-3xl font-black font-mono tracking-widest text-[var(--ink)] ${isShaking ? 'animate-shake' : ''}`}
                    style={result?.ok && curStep === steps.length - 1 ? { color: 'var(--cfg)' } : {}}
                  >
                    {displaySent || 'ε'}
                  </motion.div>
                  {result?.ok && curStep === steps.length - 1 && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                      className="result-accept mt-3 animate-pulse-ring">✓ Derived successfully</motion.div>
                  )}
                </div>
                <AnimatePresence mode="wait">
                  {guidedHint && curStep >= 0 && (
                    <motion.div key={curStep} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      className="card p-3 border-l-4" style={{ borderLeftColor: 'var(--cfg)' }}>
                      <p className="text-xs font-mono text-[var(--ink-3)] mb-0.5">Applying rule:</p>
                      <p className="text-sm font-bold text-[var(--ink)]">{steps[curStep]?.rule}</p>
                      <p className="text-xs text-[var(--ink-3)] mt-1">{guidedHint}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
                {result && !result.ok && <div className="result-reject">{result.msg}</div>}
                {treeRoot && result?.ok && curStep === steps.length - 1 && (
                  <div className="card p-4 overflow-x-auto">
                    <p className="section-label mb-3">Parse Tree</p>
                    <svg style={{ minWidth: 300, overflow: 'visible' }} height={280}>
                      <TreeNode node={treeRoot} x={300} y={30} spread={120} />
                    </svg>
                  </div>
                )}
              </div>
            )}

            {/* ── PARSE TREE ── */}
            {mode === 'parse-tree' && (
              <div className="space-y-4">
                {treeRoot ? (
                  <div className="card p-5 overflow-x-auto">
                    <p className="section-label mb-3">Parse Tree for "{input}"</p>
                    <svg style={{ minWidth: 400, overflow: 'visible' }} height={320}>
                      <TreeNode node={treeRoot} x={400} y={30} spread={140} />
                    </svg>
                  </div>
                ) : result && !result.ok ? (
                  <div className="result-reject">{result.msg}</div>
                ) : (
                  <div className="card flex flex-col items-center justify-center py-16 text-center text-[var(--ink-3)]">
                    <TreePine size={36} className="mb-3 opacity-20"/>
                    <p className="text-sm">Click <strong>Run Simulation</strong> to generate the parse tree.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── CYK TABLE ── */}
            {mode === 'cyk' && (
              <div className="space-y-4">
                {cykData ? (
                  <>
                    <div className={cykData.accepted ? 'result-accept' : 'result-reject'}>
                      {cykData.accepted ? `✓ "${input}" ∈ L(G) — CYK Accepted` : `✗ "${input}" ∉ L(G) — CYK Rejected`}
                    </div>
                    {cykData.cells.length > 0 && (
                      <div className="card p-4">
                        <CYKGrid cells={cykData.cells} input={input} startSymbol={start} />
                      </div>
                    )}
                    <div className="card p-4">
                      <p className="section-label mb-2">CYK Fill Log</p>
                      <div className="space-y-0.5 max-h-40 overflow-y-auto">
                        {cykData.explanation.map((line, i) => (
                          <p key={i} className={`text-xs font-mono ${line.includes('✓') ? 'text-green-600' : line.includes('✗') ? 'text-red-500' : 'text-[var(--ink-3)]'}`}>{line}</p>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="card flex flex-col items-center justify-center py-16 text-center text-[var(--ink-3)]">
                    <Scale size={36} className="mb-3 opacity-20"/>
                    <p className="text-sm">Run Simulation to build the CYK parse table.</p>
                    <p className="text-xs mt-1 font-mono opacity-60">Grammar will be tested in CNF-compatible mode</p>
                  </div>
                )}
              </div>
            )}

            {/* ── MEMBERSHIP ── */}
            {mode === 'membership' && cykData && (
              <div className="space-y-4">
                <div className={cykData.accepted ? 'result-accept' : 'result-reject'}>
                  {cykData.accepted ? `✓ "${input}" ∈ L(G) — Accepted` : `✗ "${input}" ∉ L(G) — Rejected`}
                </div>
                <div className="card p-4">
                  <p className="section-label mb-3">CYK Membership Steps</p>
                  <div className="space-y-1">
                    {cykData.explanation.map((line, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-mono">
                        <span className="text-[var(--ink-3)] w-4 shrink-0">{i+1}</span>
                        <span className={line.includes('✓') ? 'text-[var(--cfg)]' : line.includes('✗') ? 'text-[var(--tm)]' : 'text-[var(--ink-2)]'}>
                          {line}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── AMBIGUITY ── */}
            {mode === 'ambiguity' && (
              <div className="space-y-4">
                {/* Inherent ambiguity examples */}
                <div className="card p-4">
                  <p className="section-label mb-2">Ambiguity Examples</p>
                  <div className="flex gap-1.5 flex-wrap mb-3">
                    {AMBIGUITY_EXAMPLES.map((ex, i) => (
                      <button key={i} onClick={() => setAmbExampleIdx(i)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          ambExampleIdx === i ? 'bg-[var(--cfg-bg)] text-[var(--cfg)] border-[var(--cfg-border)]' : 'border-[var(--border)] text-[var(--ink-3)]'
                        }`}>{ex.name}</button>
                    ))}
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-2)] border border-[var(--border)]">
                    <p className="text-xs font-mono text-[var(--ink-2)] leading-relaxed mb-1">
                      {AMBIGUITY_EXAMPLES[ambExampleIdx].grammar}
                    </p>
                    <p className="text-xs text-[var(--ink-3)] leading-relaxed">
                      {AMBIGUITY_EXAMPLES[ambExampleIdx].explanation}
                    </p>
                    <span className={`mt-1 inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      AMBIGUITY_EXAMPLES[ambExampleIdx].isInherentlyAmbiguous
                        ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {AMBIGUITY_EXAMPLES[ambExampleIdx].isInherentlyAmbiguous ? '⚠ Inherently Ambiguous' : '~ Ambiguous grammar (fixable)'}
                    </span>
                  </div>
                </div>

                {/* Detection result */}
                {ambData && (
                  <>
                    <div className={ambData.isAmbiguous ? 'result-warn' : 'result-accept'}>
                      {ambData.isAmbiguous ? '⚠ AMBIGUOUS grammar detected for this input' : '✓ No ambiguity detected for this input'}
                    </div>
                    <p className="text-xs text-[var(--ink-3)] font-mono leading-relaxed">{ambData.explanation}</p>
                    {ambData.isAmbiguous && (
                      <div className="grid grid-cols-2 gap-4">
                        {[ambData.derivation1, ambData.derivation2].map((d, idx) => (
                          <div key={idx} className="card p-4">
                            <p className="section-label mb-2">Derivation {idx + 1} ({idx === 0 ? 'Leftmost' : 'Rightmost'})</p>
                            <div className="space-y-1 font-mono text-xs">
                              {d.map((s, i) => (
                                <div key={i} className="flex gap-2">
                                  <span className="text-[var(--ink-3)]">{i+1}.</span>
                                  <span className="text-[var(--ink)]">{s.sentential}</span>
                                  <span className="ml-auto text-[var(--cfg)] opacity-70">{s.rule}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {!ambData && (
                  <div className="card flex flex-col items-center justify-center py-12 text-center text-[var(--ink-3)]">
                    <Diff size={32} className="mb-3 opacity-20"/>
                    <p className="text-sm">Run simulation to detect ambiguity in your grammar.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── SIMPLIFY / CNF ── */}
            {mode === 'simplify' && simplData.length > 0 && (
              <div className="space-y-4">
                <div className="flex gap-1.5 flex-wrap">
                  {simplData.map((s, i) => (
                    <button key={i} onClick={() => setSimplIdx(i)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        simplIdx === i ? 'bg-[var(--cfg-bg)] text-[var(--cfg)] border-[var(--cfg-border)]' : 'border-[var(--border)] text-[var(--ink-3)]'
                      }`}>
                      {i+1}. {s.name}
                    </button>
                  ))}
                </div>
                <AnimatePresence mode="wait">
                  <motion.div key={simplIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
                    <p className="font-bold text-[var(--cfg)] mb-1">{simplData[simplIdx].name}</p>
                    <p className="text-xs text-[var(--ink-3)] mb-4 font-mono leading-relaxed">{simplData[simplIdx].description}</p>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Before', data: simplData[simplIdx].before, color: 'text-[var(--ink-2)]' },
                        { label: 'After',  data: simplData[simplIdx].after,  color: 'text-[var(--cfg)]' },
                      ].map(({ label, data, color }) => (
                        <div key={label}>
                          <p className="section-label mb-1.5">{label}</p>
                          <pre className={`font-mono text-xs leading-relaxed p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] ${color}`}>
                            {rulesDisplay(data)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            )}

            {/* ── MULTI-PATH ── */}
            {mode === 'multi-path' && (
              <div className="space-y-4">
                {multiPaths.length > 0 ? (
                  <>
                    <div className="result-accept">{result?.msg}</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {multiPaths.map((_, i) => (
                        <button key={i} onClick={() => setSelectedPath(i)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            selectedPath === i ? 'bg-[var(--cfg-bg)] text-[var(--cfg)] border-[var(--cfg-border)]' : 'border-[var(--border)] text-[var(--ink-3)]'
                          }`}>Path {i + 1}</button>
                      ))}
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.div key={selectedPath} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
                        <p className="section-label mb-3">Derivation Path {selectedPath + 1}</p>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-3 font-mono text-xs">
                            <span className="text-[var(--ink-3)] w-5">0.</span>
                            <span className="font-bold text-[var(--ink)] text-sm">{start}</span>
                            <span className="ml-auto text-[10px] text-[var(--ink-3)]">Start</span>
                          </div>
                          {multiPaths[selectedPath].steps.map((s, i) => (
                            <div key={i} className="flex items-center gap-3 font-mono text-xs">
                              <span className="text-[var(--ink-3)] w-5">{i+1}.</span>
                              <span className="font-semibold text-[var(--ink)] text-sm break-all">{s.sentential || 'ε'}</span>
                              <span className="ml-auto text-[10px] font-bold" style={{ color: 'var(--cfg)' }}>{s.rule}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    </AnimatePresence>
                    {multiPaths.length > 1 && (
                      <div className="card p-3 text-xs text-[var(--ink-3)] font-mono">
                        <span className="font-bold" style={{ color: 'var(--cfg)' }}>⚠ Multiple derivation paths found!</span>
                        {' '}This grammar may be ambiguous. {multiPaths.length} distinct paths produce "{input}".
                      </div>
                    )}
                  </>
                ) : result && !result.ok ? (
                  <div className="result-reject">{result.msg}</div>
                ) : (
                  <div className="card flex flex-col items-center justify-center py-16 text-center text-[var(--ink-3)]">
                    <GitBranch size={36} className="mb-3 opacity-20"/>
                    <p className="text-sm">Run Simulation to find all derivation paths for your string.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── RANDOM GEN ── */}
            {mode === 'random-gen' && (
              <div className="space-y-4">
                {randomResult ? (
                  <>
                    <div className={randomResult.success ? 'result-accept' : 'result-reject'}>
                      {randomResult.success ? `✓ Generated: "${randomResult.string}"` : '✗ Could not generate a string (grammar may not produce finite strings at this depth)'}
                    </div>
                    {randomResult.success && (
                      <div className="card p-5">
                        <p className="section-label mb-3">Generated String & Derivation</p>
                        <div className="mb-4 p-3 rounded-lg bg-[var(--cfg-bg)] border border-[var(--cfg-border)] text-center">
                          <p className="font-mono text-3xl font-black" style={{ color: 'var(--cfg)' }}>
                            "{randomResult.string || 'ε'}"
                          </p>
                          <p className="text-[10px] font-mono text-[var(--ink-3)] mt-1">length = {randomResult.string.length}</p>
                        </div>
                        <p className="section-label mb-2">Derivation Used</p>
                        <div className="space-y-1.5">
                          <div className="flex gap-3 font-mono text-xs">
                            <span className="text-[var(--ink-3)] w-5">0.</span>
                            <span className="font-bold text-[var(--ink)]">{start}</span>
                          </div>
                          {randomResult.derivation.map((s, i) => (
                            <div key={i} className="flex gap-3 font-mono text-xs">
                              <span className="text-[var(--ink-3)] w-5">{i+1}.</span>
                              <span className="text-[var(--ink)] break-all">{s.sentential || 'ε'}</span>
                              <span className="ml-auto font-bold text-[10px]" style={{ color: 'var(--cfg)' }}>{s.rule}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="card flex flex-col items-center justify-center py-16 text-center text-[var(--ink-3)]">
                    <Shuffle size={36} className="mb-3 opacity-20"/>
                    <p className="text-sm">Click <strong>Generate String</strong> to produce a valid string from your grammar.</p>
                    <p className="text-xs mt-1 font-mono opacity-60">The derivation used is shown alongside</p>
                  </div>
                )}
              </div>
            )}

            {/* ── GRAMMAR EQUIVALENCE ── */}
            {mode === 'equivalence' && (
              <div className="space-y-4">
                {equivResult ? (
                  <>
                    <div className={equivResult.likelyEquivalent ? 'result-accept' : 'result-reject'}>
                      {equivResult.likelyEquivalent ? '~ Grammars appear EQUIVALENT (heuristic)' : '✗ Grammars are NOT equivalent'}
                    </div>
                    <p className="text-xs text-[var(--ink-3)] font-mono leading-relaxed">{equivResult.explanation}</p>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Only in G1', items: equivResult.onlyInG1, color: 'text-red-500' },
                        { label: 'Both',       items: equivResult.inBoth,   color: 'text-green-600' },
                        { label: 'Only in G2', items: equivResult.onlyInG2, color: 'text-orange-500' },
                      ].map(({ label, items, color }) => (
                        <div key={label} className="card p-3">
                          <p className={`section-label mb-2 ${color}`}>{label} ({items.length})</p>
                          <div className="space-y-0.5 max-h-32 overflow-y-auto">
                            {items.length === 0 ? (
                              <p className="text-xs font-mono text-[var(--ink-3)] italic">none</p>
                            ) : items.map((s, i) => (
                              <p key={i} className={`text-xs font-mono font-bold ${color}`}>"{s}"</p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="card flex flex-col items-center justify-center py-16 text-center text-[var(--ink-3)]">
                    <Scale size={36} className="mb-3 opacity-20"/>
                    <p className="text-sm">Enter a second grammar (G2) and click <strong>Run Simulation</strong>.</p>
                    <p className="text-xs mt-1 font-mono opacity-60">Heuristic comparison using random string sampling</p>
                  </div>
                )}
              </div>
            )}

            {/* ── PROOF MODE ── */}
            {mode === 'proof' && proofSteps.length > 0 && (
              <ProofBuilder
                key={proofKey}
                title="CFL Pumping Lemma – Interactive Proof"
                description="Walk through the pumping lemma proof step by step. Each step is validated before you can proceed."
                steps={proofSteps}
                accentColor="var(--cfg)"
              />
            )}
            {mode === 'proof' && proofSteps.length === 0 && (
              <div className="card flex flex-col items-center justify-center py-16 text-center text-[var(--ink-3)]">
                <GraduationCap size={36} className="mb-3 opacity-20"/>
                <p className="text-sm">Click <strong>Start Proof</strong> to begin the interactive pumping lemma proof.</p>
                <p className="text-xs mt-1 font-mono opacity-60">Provide your grammar and an input string first</p>
              </div>
            )}

            {/* ── PUMPING LEMMA ── */}
            {mode === 'pumping' && pumpData && (
              <div className="space-y-4">
                <div className="card p-5">
                  <p className="section-label mb-3">String Decomposition: s = u·v·w</p>
                  <div className="flex gap-3 mb-5">
                    {(['u','v','w'] as const).map(p => (
                      <div key={p} className="flex-1 border-2 border-[var(--border)] rounded-xl p-3 text-center">
                        <p className="section-label mb-1">{p}</p>
                        <p className="font-mono text-xl font-black text-[var(--ink)]">"{pumpData.parts[p] || 'ε'}"</p>
                        <p className="text-[10px] text-[var(--ink-3)] mt-1">len = {pumpData.parts[p].length}</p>
                      </div>
                    ))}
                  </div>
                  <p className="section-label mb-2">Pumped Strings (uv^k w)</p>
                  <div className="space-y-1.5">
                    {Object.entries(pumpData.pumped).map(([k, s]) => (
                      <div key={k} className="flex items-center gap-3 text-sm font-mono">
                        <span className="text-[var(--ink-3)] w-16">k = {k}:</span>
                        <span className="bg-[var(--bg-2)] border border-[var(--border)] px-2 py-0.5 rounded text-[var(--ink)]">"{s || 'ε'}"</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 space-y-1 border-t border-[var(--border)] pt-3">
                    {pumpData.explanation.map((line, i) => (
                      <p key={i} className="text-xs font-mono text-[var(--ink-3)]">{line}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Simplify empty state */}
            {mode === 'simplify' && simplData.length === 0 && (
              <div className="card flex flex-col items-center justify-center py-16 text-center text-[var(--ink-3)]">
                <Wrench size={36} className="mb-3 opacity-20"/>
                <p className="text-sm">Run Simulation to simplify your grammar and convert to CNF.</p>
              </div>
            )}

            {/* Default empty state */}
            {mode === 'derivation' && steps.length === 0 && !result && (
              <div className="flex flex-col items-center justify-center h-48 text-center text-[var(--ink-3)]">
                <div className="text-4xl mb-3 opacity-20">S</div>
                <p className="text-sm">Configure your grammar and click <strong>Run Simulation</strong>.</p>
                <p className="text-xs mt-2 font-mono opacity-60">CFG · {derivType} derivation</p>
              </div>
            )}
          </div>

          {/* Playback bar */}
          {mode === 'derivation' && (
            <PlaybackBar
              currentStep={curStep}
              totalSteps={steps.length}
              isRunning={isRunning}
              speed={speed}
              onFirst={() => setCurStep(-1)}
              onPrev={() => setCurStep(p => Math.max(-1, p - 1))}
              onNext={() => setCurStep(p => Math.min(steps.length - 1, p + 1))}
              onLast={() => setCurStep(steps.length - 1)}
              onTogglePlay={togglePlay}
              onSpeedChange={s => { setSpeed(s); if (isRunning) { stopAuto(); } }}
              accentClass="btn-cfg"
              accentColor="var(--cfg)"
            />
          )}
        </div>

        {/* ── RIGHT: Step Log ───────────────────────────────── */}
        {mode === 'derivation' && steps.length > 0 && (
          <div className="w-72 border-l border-[var(--border)] flex flex-col shrink-0 overflow-hidden"
            style={{ background: 'var(--surface)' }}>
            <div className="p-3 border-b border-[var(--border)]">
              <p className="section-label">Derivation Steps</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1" ref={logRef}>
              <div className="step-card" onClick={() => setCurStep(-1)}>
                <p className="font-mono text-xs font-bold text-[var(--ink-3)]">0. Start</p>
                <p className="font-mono text-sm font-black text-[var(--ink)]">{start}</p>
              </div>
              {steps.map((s, i) => (
                <div key={i} data-step={i}
                  onClick={() => setCurStep(i)}
                  className={`step-card ${curStep === i ? 'active' : ''}`}
                  style={curStep === i ? { borderColor: 'var(--cfg)' } : {}}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-mono text-[10px] text-[var(--ink-3)]">{i+1}.</span>
                    <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--cfg)' }}>{s.rule}</span>
                  </div>
                  <p className="font-mono text-sm font-bold text-[var(--ink)] break-all">{s.sentential || 'ε'}</p>
                  <p className="text-[10px] text-[var(--ink-3)] mt-0.5 leading-tight">{s.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RIGHT: Multi-path log ─────────────────────────────── */}
        {mode === 'multi-path' && multiPaths.length > 0 && (
          <div className="w-64 border-l border-[var(--border)] flex flex-col shrink-0 overflow-hidden"
            style={{ background: 'var(--surface)' }}>
            <div className="p-3 border-b border-[var(--border)]">
              <p className="section-label">All Paths</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {multiPaths.map((path, i) => (
                <div key={i} onClick={() => setSelectedPath(i)}
                  className={`step-card cursor-pointer ${selectedPath === i ? 'active' : ''}`}
                  style={selectedPath === i ? { borderColor: 'var(--cfg)' } : {}}>
                  <p className="font-mono text-xs font-bold text-[var(--ink)]">Path {i + 1}</p>
                  <p className="text-[10px] text-[var(--ink-3)] font-mono">{path.steps.length} steps</p>
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--cfg)' }}>
                    {path.steps.map(s => s.rule).join(' → ').slice(0, 40)}
                    {path.steps.map(s => s.rule).join('').length > 40 ? '…' : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
