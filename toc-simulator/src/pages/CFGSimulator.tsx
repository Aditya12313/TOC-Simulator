import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, BookOpen, ChevronRight, TreePine, Diff, Wrench, FlaskConical, Gauge } from 'lucide-react';
import {
  parseGrammar, deriveLeftmost, deriveRightmost, cykMembership,
  detectAmbiguity, simplifyGrammar, simulatePumpingLemma, buildParseTree,
  type ParseTreeNode, type DerivationStep,
} from '../engine/cfg/CFGEngine';
import PlaybackBar from '../components/PlaybackBar';

const EXAMPLES = [
  { name: 'aⁿbⁿ',        rules: 'S -> aSb | ε', start: 'S', input: 'aabb',    desc: 'Equal a\'s and b\'s' },
  { name: 'Matching ()',   rules: 'S -> SS | (S) | ε', start: 'S', input: '(())', desc: 'Balanced parens' },
  { name: 'Arithmetic',   rules: 'E -> E+T | T\nT -> T*F | F\nF -> (E) | a', start: 'E', input: 'a+a*a', desc: 'Expr grammar' },
  { name: 'Ambiguous',    rules: 'S -> S+S | S*S | a', start: 'S', input: 'a+a*a', desc: 'No precedence' },
];

type Mode = 'derivation' | 'parse-tree' | 'ambiguity' | 'simplify' | 'membership' | 'pumping';

const MODES: { id: Mode; label: string; icon: React.ReactNode }[] = [
  { id: 'derivation',  label: 'Derivation',   icon: <ChevronRight size={12}/> },
  { id: 'parse-tree',  label: 'Parse Tree',   icon: <TreePine size={12}/> },
  { id: 'ambiguity',   label: 'Ambiguity',    icon: <Diff size={12}/> },
  { id: 'simplify',    label: 'CNF / Simplify', icon: <Wrench size={12}/> },
  { id: 'membership',  label: 'Membership',   icon: <Gauge size={12}/> },
  { id: 'pumping',     label: 'Pumping Lemma',icon: <FlaskConical size={12}/> },
];

/* SVG Parse Tree */
function TreeNode({ node, depth = 0, x = 0, y = 0, spread = 120 }:
  { node: ParseTreeNode; depth?: number; x?: number; y?: number; spread?: number }) {
  const cols = ['#16a34a','#ea580c','#e11d48','#7c3aed','#0284c7'];
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

export default function CFGSimulator() {
  const [rules, setRules]   = useState('S -> aSb | ε');
  const [start, setStart]   = useState('S');
  const [input, setInput]   = useState('aabb');
  const [mode, setMode]     = useState<Mode>('derivation');
  const [derivType, setDerivType] = useState<'leftmost'|'rightmost'>('leftmost');
  const [pumpLen, setPumpLen] = useState(3);
  const [errors, setErrors] = useState<string[]>([]);

  const [steps, setSteps]   = useState<DerivationStep[]>([]);
  const [curStep, setCurStep] = useState(-1);
  const [speed, setSpeed]   = useState(2);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [treeRoot, setTreeRoot] = useState<ParseTreeNode | null>(null);
  const [ambData, setAmbData] = useState<ReturnType<typeof detectAmbiguity> | null>(null);
  const [simplData, setSimplData] = useState<ReturnType<typeof simplifyGrammar>>([]);
  const [simplIdx, setSimplIdx]   = useState(0);
  const [cykData,  setCykData]    = useState<ReturnType<typeof cykMembership> | null>(null);
  const [pumpData, setPumpData]   = useState<ReturnType<typeof simulatePumpingLemma> | null>(null);

  // animated sentential form for guided mode
  const [guidedHint, setGuidedHint] = useState('');

  const autoRef = useRef<number|null>(null);
  const logRef  = useRef<HTMLDivElement>(null);

  const speedMs = [1200, 650, 220][speed - 1];

  const stopAuto = () => { if (autoRef.current) clearInterval(autoRef.current); setIsRunning(false); };
  const resetAll = useCallback(() => {
    stopAuto();
    setSteps([]); setCurStep(-1); setResult(null); setTreeRoot(null);
    setAmbData(null); setSimplData([]); setCykData(null); setPumpData(null);
    setErrors([]); setGuidedHint('');
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
      setCykData(cykMembership(grammar, input));
    } else if (mode === 'pumping') {
      setPumpData(simulatePumpingLemma(grammar, input, pumpLen));
    }
    setCurStep(-1);
  }, [rules, start, input, mode, derivType, pumpLen, resetAll]);

  // Auto-run
  const togglePlay = useCallback(() => {
    if (isRunning) { stopAuto(); return; }
    setIsRunning(true);
    autoRef.current = window.setInterval(() => {
      setCurStep(p => {
        if (p >= steps.length - 1) { stopAuto(); return p; }
        return p + 1;
      });
    }, speedMs);
  }, [isRunning, steps.length, speedMs]);

  useEffect(() => { if (curStep >= 0 && steps[curStep]) setGuidedHint(steps[curStep].explanation); }, [curStep, steps]);
  useEffect(() => () => stopAuto(), []);

  // Scroll step log
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

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Mode tabs */}
      <div className="border-b border-[var(--border)] px-4 py-2 flex items-center gap-2 overflow-x-auto"
        style={{ background: 'var(--surface)' }}>
        <span className="pill pill-cfg shrink-0">CFG</span>
        <span className="w-px h-4 bg-[var(--border)] shrink-0" />
        {MODES.map(m => (
          <button key={m.id} onClick={() => { setMode(m.id); resetAll(); }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all duration-150 shrink-0 ${
              mode === m.id
                ? 'bg-[var(--cfg-bg)] text-[var(--cfg)] border-[var(--cfg-border)]'
                : 'border-transparent text-[var(--ink-3)] hover:border-[var(--border)] hover:text-[var(--ink)]'
            }`}>
            {m.icon} {m.label}
          </button>
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

          {/* Inputs */}
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
            <div>
              <div className="section-label">Input String</div>
              <input className="code-input-field" value={input} onChange={e => setInput(e.target.value)} placeholder="aabb"/>
            </div>
            {mode === 'derivation' && (
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
            {mode === 'pumping' && (
              <div>
                <div className="section-label">Pumping Length (p)</div>
                <input type="number" className="code-input-field" value={pumpLen}
                  onChange={e => setPumpLen(+e.target.value)} min={1} max={20}/>
              </div>
            )}
            {errors.length > 0 && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 font-mono space-y-0.5">
                {errors.map((e,i) => <p key={i}>{e}</p>)}
              </div>
            )}
            <button onClick={runSim} className="btn-cfg w-full justify-center">
              ▶ Run Simulation
            </button>
            {(steps.length > 0 || result || ambData || cykData || pumpData) && (
              <button onClick={resetAll} className="btn-outline w-full justify-center">
                <RotateCcw size={12}/> Reset
              </button>
            )}
          </div>
        </div>

        {/* ── CENTER: Stage ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-5 dot-grid">

            {/* Derivation Mode */}
            {mode === 'derivation' && (
              <div className="space-y-4">
                {/* Sentential form display */}
                <div className="card p-5 text-center min-h-24 flex flex-col items-center justify-center">
                  <p className="section-label mb-2">Sentential Form</p>
                  <motion.div
                    key={displaySent}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className={`text-3xl font-black font-mono tracking-widest text-[var(--ink)] ${isShaking ? 'animate-shake' : ''}`}
                    style={result?.ok && curStep === steps.length - 1 ? { color: 'var(--cfg)' } : {}}
                  >
                    {displaySent || 'ε'}
                  </motion.div>
                  {result?.ok && curStep === steps.length - 1 && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                      className="result-accept mt-3 animate-pulse-ring">
                      ✓ Derived successfully
                    </motion.div>
                  )}
                </div>

                {/* Guided hint */}
                <AnimatePresence mode="wait">
                  {guidedHint && curStep >= 0 && (
                    <motion.div key={curStep}
                      initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      className="card p-3 border-l-4"
                      style={{ borderLeftColor: 'var(--cfg)' }}>
                      <p className="text-xs font-mono text-[var(--ink-3)] mb-0.5">Now applying:</p>
                      <p className="text-sm font-bold text-[var(--ink)]">{steps[curStep]?.rule}</p>
                      <p className="text-xs text-[var(--ink-3)] mt-1">{guidedHint}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Result failure */}
                {result && !result.ok && (
                  <div className="result-reject">{result.msg}</div>
                )}

                {/* Parse tree */}
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

            {/* Parse Tree Mode */}
            {mode === 'parse-tree' && (
              <div className="space-y-4">
                {treeRoot && (
                  <div className="card p-5 overflow-x-auto">
                    <p className="section-label mb-3">Parse Tree for "{input}"</p>
                    <svg style={{ minWidth: 400, overflow: 'visible' }} height={320}>
                      <TreeNode node={treeRoot} x={400} y={30} spread={140} />
                    </svg>
                  </div>
                )}
                {result && !result.ok && <div className="result-reject">{result.msg}</div>}
                {!treeRoot && !result && (
                  <div className="card flex flex-col items-center justify-center py-16 text-center text-[var(--ink-3)]">
                    <TreePine size={36} className="mb-3 opacity-20"/>
                    <p className="text-sm">Click Run Simulation to generate the parse tree.</p>
                  </div>
                )}
              </div>
            )}

            {/* Ambiguity Mode */}
            {mode === 'ambiguity' && ambData && (
              <div className="space-y-4">
                <div className={ambData.isAmbiguous ? 'result-warn' : 'result-accept'}>
                  {ambData.isAmbiguous ? '⚠ AMBIGUOUS grammar detected' : '✓ No ambiguity detected'}
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
              </div>
            )}

            {/* Simplify / CNF */}
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
                  <motion.div key={simplIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="card p-5">
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

            {/* Membership / CYK */}
            {mode === 'membership' && cykData && (
              <div className="space-y-4">
                <div className={cykData.accepted ? 'result-accept' : 'result-reject'}>
                  {cykData.accepted ? `✓ "${input}" ∈ L(G) — Accepted` : `✗ "${input}" ∉ L(G) — Rejected`}
                </div>
                <div className="card p-4">
                  <p className="section-label mb-3">CYK Table Steps</p>
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

            {/* Pumping Lemma */}
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
                        <span className="bg-[var(--bg-2)] border border-[var(--border)] px-2 py-0.5 rounded text-[var(--ink)]">
                          "{s || 'ε'}"
                        </span>
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

            {/* Empty state */}
            {mode === 'derivation' && steps.length === 0 && !result && (
              <div className="flex flex-col items-center justify-center h-48 text-center text-[var(--ink-3)]">
                <div className="text-4xl mb-3 opacity-20">S</div>
                <p className="text-sm">Configure your grammar and click <strong>Run Simulation</strong>.</p>
                <p className="text-xs mt-2 font-mono opacity-60">CFG · {derivType} derivation</p>
              </div>
            )}
          </div>

          {/* Playback bar */}
          {(mode === 'derivation') && (
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
      </div>
    </div>
  );
}
