import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw, BookOpen, Layers, RefreshCw, GitBranch,
  MousePointer, AlertTriangle, List,
} from 'lucide-react';
import {
  parsePDADefinition, simulatePDA, cfgToPDA, buildPathTree,
  detectInfiniteLoopInPath, getAllAcceptingPaths,
  type PDAStep, type PDADefinition, type PDAPathNode,
} from '../engine/pda/PDAEngine';
import { parseGrammar as parseCFGGrammar } from '../engine/cfg/CFGEngine';
import PlaybackBar from '../components/PlaybackBar';

const PDA_EXAMPLES = [
  {
    name: 'aⁿbⁿ', desc: 'Equal a\'s and b\'s', input: 'aaabbb',
    def: `# PDA for a^n b^n\nstates: q0,q1,q2\ninput: a,b\nstack: A,Z\nstart: q0\ninitial_stack: Z\naccept: q2\nδ(q0,a,Z) = (q0,AZ)\nδ(q0,a,A) = (q0,AA)\nδ(q0,b,A) = (q1,ε)\nδ(q1,b,A) = (q1,ε)\nδ(q1,ε,Z) = (q2,Z)`,
  },
  {
    name: 'Palindrome', desc: 'Palindromes over {a,b,c}', input: 'abcba',
    def: `# PDA for palindromes\nstates: q0,q1,q2\ninput: a,b,c\nstack: A,B,C,Z\nstart: q0\ninitial_stack: Z\naccept: q2\nδ(q0,a,ε) = (q0,A)\nδ(q0,b,ε) = (q0,B)\nδ(q0,c,ε) = (q1,ε)\nδ(q0,ε,ε) = (q1,ε)\nδ(q1,a,A) = (q1,ε)\nδ(q1,b,B) = (q1,ε)\nδ(q1,ε,Z) = (q2,Z)`,
  },
  {
    name: 'Brackets', desc: 'Balanced ( and )', input: '(()())',
    def: `# PDA for balanced parens\nstates: q0,q1\ninput: (,)\nstack: P,Z\nstart: q0\ninitial_stack: Z\naccept: q1\nδ(q0,(,ε) = (q0,P)\nδ(q0,),P) = (q0,ε)\nδ(q0,ε,Z) = (q1,Z)`,
  },
];

type PDAMode = 'simulation' | 'cfg-to-pda' | 'computation-tree' | 'language-trace' | 'loop-detect' | 'stack-inspect';

const PDA_MODES: { id: PDAMode; label: string; icon: React.ReactNode }[] = [
  { id: 'simulation',       label: 'Simulation',      icon: <Layers size={11}/> },
  { id: 'cfg-to-pda',       label: 'CFG → PDA',        icon: <RefreshCw size={11}/> },
  { id: 'computation-tree', label: 'Comp. Tree',      icon: <GitBranch size={11}/> },
  { id: 'language-trace',   label: 'Language Trace',  icon: <List size={11}/> },
  { id: 'loop-detect',      label: 'Loop Detect',     icon: <AlertTriangle size={11}/> },
  { id: 'stack-inspect',    label: 'Stack Inspect',   icon: <MousePointer size={11}/> },
];

/* ── Stack Visualization ─────────────────────────────── */
function StackViz({
  stack, prevStack, pushHistory,
  inspectMode = false,
}: {
  stack: string[];
  prevStack: string[];
  pushHistory?: Array<{ symbol: string; pushedAtStep: number; transition: string }>;
  inspectMode?: boolean;
}) {
  const [inspected, setInspected] = useState<number | null>(null);

  return (
    <div className="flex flex-col items-center">
      <p className="section-label mb-2 text-center">↑ TOP</p>
      <div className="flex flex-col items-center border-x border-t border-[var(--border)] rounded-t-lg overflow-hidden"
        style={{ minHeight: 80, minWidth: 72 }}>
        <AnimatePresence>
          {stack.length === 0
            ? <div className="w-full h-10 flex items-center justify-center text-[var(--ink-3)] text-xs font-mono italic">empty</div>
            : stack.slice(0, 12).map((sym, i) => {
                const isTop = i === 0;
                const isFresh = i < prevStack.length ? sym !== prevStack[i] : true;
                const histEntry = pushHistory?.[i];
                return (
                  <motion.div key={`${sym}-${i}`}
                    initial={{ opacity: 0, y: -16, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    className={`stack-cell ${isTop ? 'top' : isFresh ? 'fresh' : ''} relative`}
                    style={{ width: 72, cursor: inspectMode ? 'pointer' : 'default' }}
                    onClick={() => inspectMode ? setInspected(inspected === i ? null : i) : null}
                  >
                    {sym}
                    {inspectMode && inspected === i && histEntry && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute left-full ml-2 z-10 w-44 card p-2 text-left"
                        style={{ top: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                        <p className="text-[9px] font-mono font-bold text-[var(--pda)]">Symbol: {sym}</p>
                        <p className="text-[9px] font-mono text-[var(--ink-3)]">Pushed at step {histEntry.pushedAtStep}</p>
                        <p className="text-[9px] font-mono text-[var(--ink-2)] mt-0.5 break-all">{histEntry.transition}</p>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
        </AnimatePresence>
      </div>
      {stack.length > 12 && <p className="text-[10px] text-[var(--ink-3)] font-mono mt-1">+{stack.length-12} more</p>}
      <div className="w-[72px] h-2 border-x border-b border-[var(--border)] rounded-b-lg"
        style={{ background: 'var(--bg-2)' }} />
      <p className="section-label mt-1 text-center">BOTTOM</p>
    </div>
  );
}

/* ── Computation Tree Node (PDA) ─────────────────────── */
function PDATreeNode({
  node, x, y, spread = 100, maxDepth = 4,
}: { node: PDAPathNode; x: number; y: number; spread?: number; maxDepth?: number }) {
  const childCount = node.children.length;
  const childSpread = Math.max(60, spread / Math.max(childCount, 1));
  const startX = x - ((childCount - 1) * childSpread) / 2;
  const depth = node.stepNum;

  if (depth >= maxDepth) return null;

  const fillColor = node.isAccepting ? '#16a34a' : node.isDead ? '#6b7280' : node.isLoop ? '#d97706' : 'var(--surface)';
  const strokeColor = node.isAccepting ? '#14532d' : node.isDead ? '#374151' : node.isLoop ? '#92400e' : 'var(--pda-border)';
  const textColor = (node.isAccepting || node.isDead || node.isLoop) ? '#fff' : 'var(--pda)';

  return (
    <g>
      {node.children.map((child, i) => {
        if (depth >= maxDepth - 1) return null;
        const cx = startX + i * childSpread;
        const cy = y + 64;
        return (
          <g key={i}>
            <motion.line x1={x} y1={y + 14} x2={cx} y2={cy - 14}
              stroke={node.isAccepting ? '#16a34a' : 'var(--border)'} strokeWidth="1.5"
              strokeDasharray={child.isLoop ? '5,3' : undefined}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: depth * 0.1 }} />
            <PDATreeNode node={child} x={cx} y={cy} spread={childSpread * 0.8} maxDepth={maxDepth} />
          </g>
        );
      })}
      <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: depth * 0.1, type: 'spring', stiffness: 280 }}>
        <circle cx={x} cy={y} r="13" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
        <text x={x} y={y + 4} textAnchor="middle" fontSize="7.5" fontFamily="JetBrains Mono" fontWeight="700" fill={textColor}>
          {node.config.state}
        </text>
        {node.isAccepting && <circle cx={x} cy={y} r="9" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>}
      </motion.g>
      {/* Tooltip label */}
      <text x={x} y={y + 26} textAnchor="middle" fontSize="7" fontFamily="JetBrains Mono" fill="var(--ink-3)">
        {node.config.remainingInput ? `"${node.config.remainingInput.slice(0,4)}${node.config.remainingInput.length > 4 ? '…' : ''}"` : 'ε'}
      </text>
    </g>
  );
}

export default function PDASimulator() {
  const [definition, setDefinition] = useState(PDA_EXAMPLES[0].def);
  const [inputStr,   setInputStr]   = useState(PDA_EXAMPLES[0].input);
  const [acceptMode, setAcceptMode] = useState<'final-state'|'empty-stack'>('final-state');
  const [mode, setMode]             = useState<PDAMode>('simulation');
  const [cfgText,    setCfgText]    = useState('S -> aSb | ε');
  const [cfgStart,   setCfgStart]   = useState('S');
  const [cfgConvSteps, setCfgConvSteps] = useState<string[]>([]);

  const [pda,        setPda]        = useState<PDADefinition | null>(null);
  const [steps,      setSteps]      = useState<PDAStep[]>([]);
  const [curStep,    setCurStep]    = useState(0);
  const [speed,      setSpeed]      = useState(2);
  const [isRunning,  setIsRunning]  = useState(false);
  const [errors,     setErrors]     = useState<string[]>([]);
  const [result,     setResult]     = useState<{ ok: boolean; msg: string }|null>(null);
  const [simulated,  setSimulated]  = useState(false);

  // Advanced mode state
  const [treeRoot,   setTreeRoot]   = useState<PDAPathNode | null>(null);
  const [acceptingPaths, setAcceptingPaths] = useState<PDAStep[][]>([]);
  const [loopInfo,   setLoopInfo]   = useState<{ hasLoop: boolean; loopStartStep: number } | null>(null);
  const [langInputs, setLangInputs] = useState('aabb\naaabbb\nab\naabbb\naabb\nε');
  const [langResults, setLangResults] = useState<Array<{ input: string; accepted: boolean; steps: number }>>([]);

  // Stack inspection history
  const [stackPushHistory, setStackPushHistory] = useState<Array<{ symbol: string; pushedAtStep: number; transition: string }>>([]);

  const autoRef = useRef<number|null>(null);
  const logRef  = useRef<HTMLDivElement>(null);
  const speedMs = [1400, 750, 250][speed - 1];

  const stopAuto = () => { if (autoRef.current) clearInterval(autoRef.current); setIsRunning(false); };
  const resetAll = useCallback(() => {
    stopAuto(); setSteps([]); setCurStep(0); setResult(null); setSimulated(false);
    setPda(null); setErrors([]); setCfgConvSteps([]); setTreeRoot(null);
    setAcceptingPaths([]); setLoopInfo(null); setLangResults([]); setStackPushHistory([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsePDA = useCallback((): PDADefinition | null => {
    if (mode === 'cfg-to-pda') {
      const { grammar, errors: ge } = parseCFGGrammar(cfgText, cfgStart);
      if (ge.length) { setErrors(ge); return null; }
      const { pda: converted, steps: convSteps } = cfgToPDA(grammar);
      setCfgConvSteps(convSteps);
      return converted;
    } else {
      const { pda: parsed, errors: pe } = parsePDADefinition(definition);
      if (pe.length) { setErrors(pe); return null; }
      return parsed!;
    }
  }, [mode, cfgText, cfgStart, definition]);

  const runSim = useCallback(() => {
    resetAll();
    const parsed = parsePDA();
    if (!parsed) return;
    setPda(parsed);

    const effMode = mode === 'cfg-to-pda' ? 'empty-stack' : acceptMode;

    if (mode === 'simulation' || mode === 'cfg-to-pda') {
      const trace = simulatePDA(parsed, inputStr, effMode);
      setSteps(trace.steps); setResult({ ok: trace.accepted, msg: trace.message });
      setSimulated(true); setCurStep(0);
      // Build stack push history for inspector
      const hist: Array<{ symbol: string; pushedAtStep: number; transition: string }> = [];
      for (const step of trace.steps) {
        if (step.appliedTransition?.pushSymbols.length) {
          for (const sym of step.appliedTransition.pushSymbols) {
            hist.push({ symbol: sym, pushedAtStep: step.stepNum, transition: step.explanation });
          }
        }
      }
      setStackPushHistory(hist);
    } else if (mode === 'computation-tree') {
      const { root } = buildPathTree(parsed, inputStr, effMode, 150);
      setTreeRoot(root);
      const paths = getAllAcceptingPaths(parsed, inputStr, effMode, 10);
      setAcceptingPaths(paths);
      const accepted = paths.length > 0;
      setResult({ ok: accepted, msg: accepted ? `✓ Accepted — ${paths.length} accepting path(s)` : '✗ Rejected — no accepting paths' });
      setSimulated(true);
    } else if (mode === 'loop-detect') {
      const trace = simulatePDA(parsed, inputStr, effMode);
      setSteps(trace.steps);
      const info = detectInfiniteLoopInPath(trace.steps);
      setLoopInfo(info);
      setResult({ ok: trace.accepted, msg: trace.message });
      setSimulated(true); setCurStep(0);
    } else if (mode === 'stack-inspect') {
      const trace = simulatePDA(parsed, inputStr, effMode);
      setSteps(trace.steps); setResult({ ok: trace.accepted, msg: trace.message });
      setSimulated(true); setCurStep(0);
      // Build richer stack push history
      const hist: Array<{ symbol: string; pushedAtStep: number; transition: string }> = [];
      for (const step of trace.steps) {
        if (step.appliedTransition?.pushSymbols.length) {
          for (const sym of step.appliedTransition.pushSymbols) {
            hist.push({ symbol: sym, pushedAtStep: step.stepNum, transition: step.explanation });
          }
        }
      }
      setStackPushHistory(hist);
    } else if (mode === 'language-trace') {
      const inputs = langInputs.split('\n').map(s => s.trim().replace(/^ε$/, '')).filter((_, i, arr) => arr.indexOf(_) === i);
      const results = inputs.map(inp => {
        const trace = simulatePDA(parsed, inp, effMode);
        return { input: inp || 'ε', accepted: trace.accepted, steps: trace.steps.length };
      });
      setLangResults(results);
      setSimulated(true);
    }
  }, [mode, parsePDA, inputStr, acceptMode, langInputs, resetAll]);

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

  useEffect(() => () => stopAuto(), []);

  useEffect(() => {
    if (logRef.current && curStep >= 0) {
      const el = logRef.current.querySelector(`[data-step="${curStep}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [curStep]);

  const cur  = steps[curStep];
  const prev = curStep > 0 ? steps[curStep - 1] : null;
  const isAtEnd = curStep === steps.length - 1;

  // Loop detection highlight
  const isLoopStep = loopInfo?.hasLoop && curStep >= (loopInfo.loopStartStep ?? Infinity);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Mode tabs */}
      <div className="border-b border-[var(--border)] px-4 py-2 flex items-center gap-2 overflow-x-auto"
        style={{ background: 'var(--surface)' }}>
        <span className="pill pill-pda shrink-0">PDA</span>
        <span className="w-px h-4 bg-[var(--border)]" />
        {PDA_MODES.map(m => (
          <button key={m.id} onClick={() => { setMode(m.id); resetAll(); }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all shrink-0 ${
              mode === m.id ? 'bg-[var(--pda-bg)] text-[var(--pda)] border-[var(--pda-border)]' : 'border-transparent text-[var(--ink-3)] hover:border-[var(--border)]'
            }`}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Input ────────────────────────────────── */}
        <div className="w-64 border-r border-[var(--border)] flex flex-col overflow-y-auto shrink-0"
          style={{ background: 'var(--bg-2)' }}>
          {mode === 'simulation' && (
            <div className="p-3 border-b border-[var(--border)]">
              <div className="section-label flex items-center gap-1"><BookOpen size={10}/> Examples</div>
              <div className="space-y-1">
                {PDA_EXAMPLES.map(ex => (
                  <button key={ex.name} onClick={() => { setDefinition(ex.def); setInputStr(ex.input); resetAll(); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface)] border border-transparent hover:border-[var(--border)] transition-all text-xs">
                    <div className="font-semibold text-[var(--ink)]">{ex.name}</div>
                    <div className="text-[var(--ink-3)] mt-0.5 font-mono text-[10px]">{ex.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 space-y-3 flex-1">
            {mode === 'cfg-to-pda' ? (
              <>
                <div>
                  <div className="section-label">CFG Rules</div>
                  <textarea className="code-input h-28 resize-none" value={cfgText} onChange={e => setCfgText(e.target.value)} placeholder="S -> aSb | ε"/>
                </div>
                <div>
                  <div className="section-label">Start Symbol</div>
                  <input className="code-input-field" value={cfgStart} onChange={e => setCfgStart(e.target.value)}/>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="section-label">PDA Definition</div>
                  <textarea className="code-input h-44 resize-none" value={definition} onChange={e => setDefinition(e.target.value)}/>
                  <p className="text-[10px] text-[var(--ink-3)] mt-1 font-mono">δ(state,input,stackTop) = (newState,push)</p>
                </div>
              </>
            )}

            {mode === 'language-trace' ? (
              <div>
                <div className="section-label">Test Strings (one per line, ε for empty)</div>
                <textarea className="code-input h-32 resize-none" value={langInputs} onChange={e => setLangInputs(e.target.value)}/>
              </div>
            ) : (
              <div>
                <div className="section-label">Input String</div>
                <input className="code-input-field" value={inputStr} onChange={e => setInputStr(e.target.value)} placeholder="aaabbb"/>
              </div>
            )}

            {/* Formal config display */}
            {cur && (
              <div className="px-2.5 py-2 rounded-lg border border-[var(--pda-border)] bg-[var(--pda-bg)] font-mono text-[10px]" style={{ color: 'var(--pda)' }}>
                <span className="text-[var(--ink-3)]">Config: </span>
                <span className="font-bold">({cur.config.state}, "{cur.config.remainingInput || 'ε'}", [{cur.config.stack.join(',') || '∅'}])</span>
              </div>
            )}

            {(mode === 'simulation' || mode === 'loop-detect' || mode === 'stack-inspect') && (
              <div>
                <div className="section-label">Acceptance Mode</div>
                <div className="flex gap-1.5">
                  {(['final-state','empty-stack'] as const).map(m => (
                    <button key={m} onClick={() => setAcceptMode(m)}
                      className={`flex-1 py-1 text-[11px] font-semibold border rounded-lg transition-all ${
                        acceptMode === m ? 'bg-[var(--pda-bg)] text-[var(--pda)] border-[var(--pda-border)]' : 'border-[var(--border)] text-[var(--ink-3)]'
                      }`}>{m === 'final-state' ? 'Final State' : 'Empty Stack'}</button>
                  ))}
                </div>
              </div>
            )}

            {errors.length > 0 && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 font-mono space-y-0.5">
                {errors.map((e,i) => <p key={i}>{e}</p>)}
              </div>
            )}
            <button onClick={runSim} className="btn-pda w-full justify-center">
              ▶ {mode === 'language-trace' ? 'Trace All' : mode === 'cfg-to-pda' ? 'Convert & Simulate' : mode === 'computation-tree' ? 'Build Tree' : 'Simulate PDA'}
            </button>
            {simulated && <button onClick={resetAll} className="btn-outline w-full justify-center"><RotateCcw size={12}/> Reset</button>}
          </div>
        </div>

        {/* ── CENTER: Visualization ──────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-5 dot-grid">

            {/* ── SIMULATION MODE ── */}
            {(mode === 'simulation' || mode === 'cfg-to-pda' || mode === 'loop-detect' || mode === 'stack-inspect') && simulated && cur ? (
              <div className="space-y-4">
                {/* Loop detection alert */}
                {loopInfo?.hasLoop && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="card p-3 flex items-center gap-2 border-l-4" style={{ borderLeftColor: '#d97706' }}>
                    <AlertTriangle size={16} className="text-amber-500 shrink-0"/>
                    <div>
                      <p className="text-xs font-bold text-amber-700">Infinite Loop Detected!</p>
                      <p className="text-[11px] font-mono text-amber-600">Configuration repeated at step {loopInfo.loopStartStep}. This path may loop forever.</p>
                    </div>
                  </motion.div>
                )}

                {/* Formal notation header */}
                <div className="card p-3 font-mono text-sm" style={{ borderLeft: '3px solid var(--pda)' }}>
                  <span className="text-[var(--ink-3)] text-xs">Formal Config: </span>
                  <span className="font-bold" style={{ color: 'var(--pda)' }}>
                    ({cur.config.state},&nbsp;
                    "{cur.config.remainingInput || 'ε'}",&nbsp;
                    [{cur.config.stack.join(',') || '∅'}])
                  </span>
                </div>

                {/* Dashboard */}
                <div className="grid grid-cols-3 gap-3">
                  <div className={`card p-4 text-center ${isLoopStep ? 'border-amber-500 border-2' : ''}`}>
                    <p className="section-label mb-2">State</p>
                    <motion.p key={cur.config.state}
                      initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="text-3xl font-black font-mono"
                      style={{ color: result?.ok && isAtEnd ? 'var(--cfg)' : !result?.ok && isAtEnd ? 'var(--tm)' : 'var(--pda)' }}>
                      {cur.config.state}
                    </motion.p>
                    {pda?.acceptStates.includes(cur.config.state) && (
                      <span className="pill pill-cfg mt-2">accept</span>
                    )}
                  </div>
                  <div className="card p-4 text-center">
                    <p className="section-label mb-2">Remaining Input</p>
                    <div className="font-mono text-xl font-bold text-[var(--ink)] min-h-8 flex items-center justify-center break-all">
                      {cur.config.remainingInput || <span className="text-[var(--ink-3)] italic text-sm">ε (empty)</span>}
                    </div>
                  </div>
                  <div className="card p-4 flex flex-col items-center">
                    <StackViz
                      stack={cur.config.stack}
                      prevStack={prev?.config.stack ?? []}
                      pushHistory={mode === 'stack-inspect' ? stackPushHistory : undefined}
                      inspectMode={mode === 'stack-inspect'}
                    />
                    {mode === 'stack-inspect' && (
                      <p className="text-[9px] font-mono text-[var(--ink-3)] mt-1 text-center">Click symbols to inspect</p>
                    )}
                  </div>
                </div>

                {/* Transition */}
                {cur.appliedTransition && (
                  <motion.div key={curStep} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                    className="card p-4 border-l-4" style={{ borderLeftColor: 'var(--pda)' }}>
                    <p className="section-label mb-1">Applied Transition</p>
                    <p className="font-mono text-sm font-bold text-[var(--ink)] mb-1.5">
                      δ({cur.appliedTransition.fromState}, {cur.appliedTransition.inputSymbol||'ε'}, {cur.appliedTransition.stackTop||'ε'})
                      &nbsp;=&nbsp;
                      ({cur.appliedTransition.toState}, {cur.appliedTransition.pushSymbols.join('')||'ε'})
                    </p>
                    <p className="text-xs text-[var(--ink-3)] font-mono leading-relaxed">{cur.explanation}</p>
                  </motion.div>
                )}

                {/* Result */}
                {result && isAtEnd && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className={`animate-pop-in ${result.ok ? 'result-accept' : 'result-reject'}`}>
                    {result.msg}
                  </motion.div>
                )}

                {/* CFG conversion log */}
                {cfgConvSteps.length > 0 && (
                  <div className="card p-4">
                    <p className="section-label mb-2">CFG → PDA Conversion</p>
                    <div className="space-y-0.5">
                      {cfgConvSteps.map((s, i) => <p key={i} className="text-xs font-mono text-[var(--ink-3)]">{s}</p>)}
                    </div>
                  </div>
                )}
              </div>

            ) : mode === 'computation-tree' && treeRoot ? (
              /* ── COMPUTATION TREE ── */
              <div className="space-y-4">
                {result && <div className={result.ok ? 'result-accept' : 'result-reject'}>{result.msg}</div>}
                <div className="card p-4">
                  <div className="flex items-center gap-4 mb-3">
                    <p className="section-label flex-1">Nondeterministic Computation Tree</p>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--ink-3)]">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"/>accept</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-500 inline-block"/>dead</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"/>loop</span>
                    </div>
                  </div>
                  <div className="overflow-auto" style={{ maxHeight: 340 }}>
                    <svg style={{ minWidth: 600, overflow: 'visible' }} height={320}>
                      <PDATreeNode node={treeRoot} x={300} y={30} spread={160} maxDepth={5} />
                    </svg>
                  </div>
                  <p className="text-[9px] font-mono text-[var(--ink-3)] mt-2">
                    Each node shows the PDA state. Dashed edges are loop-detected paths. Max depth: 4 levels shown.
                  </p>
                </div>

                {acceptingPaths.length > 0 && (
                  <div className="card p-4">
                    <p className="section-label mb-2">Accepting Paths ({acceptingPaths.length})</p>
                    <div className="space-y-2">
                      {acceptingPaths.slice(0, 5).map((path, i) => (
                        <div key={i} className="p-2 rounded-lg bg-[var(--cfg-bg)] border border-[var(--cfg-border)]">
                          <p className="text-xs font-bold text-green-700 mb-1">Path {i+1} — {path.length} steps</p>
                          <p className="text-[10px] font-mono text-[var(--ink-3)]">
                            {path.map(s => s.config.state).join(' → ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            ) : mode === 'language-trace' && langResults.length > 0 ? (
              /* ── LANGUAGE TRACE ── */
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <div className="card p-2 text-center">
                    <p className="text-green-600 font-bold text-lg">{langResults.filter(r => r.accepted).length}</p>
                    <p className="text-[var(--ink-3)]">Accepted</p>
                  </div>
                  <div className="card p-2 text-center">
                    <p className="text-red-500 font-bold text-lg">{langResults.filter(r => !r.accepted).length}</p>
                    <p className="text-[var(--ink-3)]">Rejected</p>
                  </div>
                  <div className="card p-2 text-center">
                    <p className="text-[var(--pda)] font-bold text-lg">{langResults.length}</p>
                    <p className="text-[var(--ink-3)]">Total</p>
                  </div>
                </div>
                <div className="card overflow-hidden">
                  <div className="p-3 border-b border-[var(--border)]">
                    <p className="section-label">Language Trace Results</p>
                  </div>
                  <table className="w-full text-xs">
                    <thead style={{ background: 'var(--bg-2)' }}>
                      <tr className="border-b border-[var(--border)]">
                        {['Input', 'Result', 'Steps'].map(h => (
                          <th key={h} className="text-left py-2 px-3 font-mono text-[10px] text-[var(--ink-3)]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {langResults.map((r, i) => (
                        <tr key={i} className="border-b border-[var(--border)]">
                          <td className="py-2 px-3 font-mono font-bold text-[var(--ink)]">"{r.input}"</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.accepted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {r.accepted ? '✓ Accept' : '✗ Reject'}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-[var(--ink-3)]">{r.steps}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            ) : (
              /* ── EMPTY STATE ── */
              <div className="flex flex-col items-center justify-center h-48 text-center text-[var(--ink-3)]">
                <Layers size={40} className="mb-3 opacity-20"/>
                <p className="text-sm">Configure your PDA and click <strong>Simulate</strong>.</p>
                <p className="text-xs mt-1 font-mono opacity-60">
                  {mode === 'computation-tree' ? 'Nondeterminism explored as full tree' :
                   mode === 'language-trace' ? 'Enter strings to trace, one per line' :
                   mode === 'loop-detect' ? 'Detects repeated configurations' :
                   mode === 'stack-inspect' ? 'Click stack symbols to see push provenance' :
                   'nondeterminism explored via BFS'}
                </p>
              </div>
            )}
          </div>

          {/* Playback */}
          {(mode === 'simulation' || mode === 'cfg-to-pda' || mode === 'loop-detect' || mode === 'stack-inspect') && (
            <PlaybackBar
              currentStep={simulated ? curStep : -1}
              totalSteps={steps.length}
              isRunning={isRunning}
              speed={speed}
              onFirst={() => setCurStep(0)}
              onPrev={() => setCurStep(p => Math.max(0, p - 1))}
              onNext={() => setCurStep(p => Math.min(steps.length - 1, p + 1))}
              onLast={() => setCurStep(steps.length - 1)}
              onTogglePlay={togglePlay}
              onSpeedChange={s => { setSpeed(s); stopAuto(); }}
              accentClass="btn-pda" accentColor="var(--pda)"
            />
          )}
        </div>

        {/* ── RIGHT: Trace Table ─────────────────────────── */}
        {simulated && steps.length > 0 && mode !== 'language-trace' && mode !== 'computation-tree' && (
          <div className="w-72 border-l border-[var(--border)] flex flex-col shrink-0 overflow-hidden"
            style={{ background: 'var(--surface)' }}>
            <div className="p-3 border-b border-[var(--border)]">
              <p className="section-label">Configuration Trace</p>
            </div>
            <div className="flex-1 overflow-y-auto" ref={logRef}>
              <table className="w-full text-xs">
                <thead className="sticky top-0" style={{ background: 'var(--bg-2)' }}>
                  <tr className="border-b border-[var(--border)]">
                    {['#','State','Input','Stack'].map(h => (
                      <th key={h} className="text-left py-1.5 px-2 font-mono text-[10px] text-[var(--ink-3)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {steps.map((s, i) => {
                    const isLoop = loopInfo?.hasLoop && i >= (loopInfo.loopStartStep ?? Infinity);
                    return (
                      <tr key={i} data-step={i} onClick={() => setCurStep(i)}
                        className="border-b border-[var(--border)] cursor-pointer transition-colors"
                        style={{
                          background: curStep === i ? 'var(--pda-bg)' : isLoop ? 'rgba(217,119,6,0.07)' : undefined,
                        }}>
                        <td className="py-1.5 px-2 font-mono text-[var(--ink-3)]">{s.stepNum}</td>
                        <td className="py-1.5 px-2 font-mono font-bold" style={{ color: isLoop ? '#d97706' : 'var(--pda)' }}>{s.config.state}</td>
                        <td className="py-1.5 px-2 font-mono text-[var(--ink-2)]">{s.config.remainingInput||'ε'}</td>
                        <td className="py-1.5 px-2 font-mono text-[var(--ink-3)]">[{s.config.stack.join(',') || '∅'}]</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
