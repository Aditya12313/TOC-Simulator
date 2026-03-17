import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, SkipForward, SkipBack, RotateCcw, Pause, ChevronRight, BookOpen, Info, TreePine, Diff, Wrench, Beaker } from 'lucide-react';
import {
  parseGrammar,
  deriveLeftmost,
  deriveRightmost,
  cykMembership,
  detectAmbiguity,
  simplifyGrammar,
  simulatePumpingLemma,
  buildParseTree,
  type ParseTreeNode,
  type DerivationStep,
} from '../engine/cfg/CFGEngine';

const EXAMPLE_GRAMMARS = [
  {
    name: 'Matching Parentheses',
    rules: 'S -> SS | (S) | ε',
    start: 'S',
    input: '(())',
    description: 'Classic grammar for balanced parentheses',
  },
  {
    name: 'aⁿbⁿ Language',
    rules: 'S -> aSb | ε',
    start: 'S',
    input: 'aabb',
    description: 'Grammar generating equal numbers of a and b',
  },
  {
    name: 'Arithmetic Expressions',
    rules: 'E -> E+T | T\nT -> T*F | F\nF -> (E) | a',
    start: 'E',
    input: 'a+a*a',
    description: 'Grammar for arithmetic (+, *) with precedence',
  },
  {
    name: 'Ambiguous Grammar',
    rules: 'S -> S+S | S*S | a',
    start: 'S',
    input: 'a+a*a',
    description: 'Ambiguous expression grammar (no precedence)',
  },
];

type SimMode = 'derivation' | 'parse-tree' | 'ambiguity' | 'simplify' | 'pumping' | 'membership';

function ParseTreeViz({ node, depth = 0 }: { node: ParseTreeNode; depth?: number }) {
  const colors = ['text-primary-400', 'text-accent-400', 'text-emerald-400', 'text-yellow-400', 'text-orange-400'];
  const color = colors[depth % colors.length];
  return (
    <div className="flex flex-col items-center">
      <div className={`px-2 py-1 rounded border border-current/30 bg-current/10 text-xs font-mono font-bold ${color} min-w-[28px] text-center`}>
        {node.symbol}
      </div>
      {node.children.length > 0 && (
        <div className="flex flex-col items-center">
          <div className="w-px h-3 bg-white/20" />
          <div className="flex gap-4 items-start justify-center">
            {node.children.map((child, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-px h-3 bg-white/20" />
                <ParseTreeViz node={child} depth={depth + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CFGSimulator() {
  const [rulesText, setRulesText] = useState('S -> aSb | ε');
  const [startSymbol, setStartSymbol] = useState('S');
  const [inputString, setInputString] = useState('aabb');
  const [derivationType, setDerivationType] = useState<'leftmost' | 'rightmost'>('leftmost');
  const [mode, setMode] = useState<SimMode>('derivation');
  const [errors, setErrors] = useState<string[]>([]);

  // Simulation state
  const [steps, setSteps] = useState<DerivationStep[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [parseTreeRoot, setParseTreeRoot] = useState<ParseTreeNode | null>(null);
  const [ambiguityResult, setAmbiguityResult] = useState<ReturnType<typeof detectAmbiguity> | null>(null);
  const [simplifySteps, setSimplifySteps] = useState<ReturnType<typeof simplifyGrammar>>([]);
  const [simplifyIdx, setSimplifyIdx] = useState(0);
  const [cykResult, setCykResult] = useState<ReturnType<typeof cykMembership> | null>(null);
  const [pumpingResult, setPumpingResult] = useState<ReturnType<typeof simulatePumpingLemma> | null>(null);
  const [pumpingLength, setPumpingLength] = useState(3);

  const autoRunRef = useRef<number | null>(null);

  const loadExample = (ex: typeof EXAMPLE_GRAMMARS[0]) => {
    setRulesText(ex.rules);
    setStartSymbol(ex.start);
    setInputString(ex.input);
    reset();
  };

  const reset = useCallback(() => {
    setSteps([]);
    setCurrentStep(-1);
    setIsRunning(false);
    setResult(null);
    setParseTreeRoot(null);
    setAmbiguityResult(null);
    setSimplifySteps([]);
    setCykResult(null);
    setPumpingResult(null);
    setErrors([]);
    if (autoRunRef.current) clearInterval(autoRunRef.current);
  }, []);

  const simulate = useCallback(() => {
    reset();
    const { grammar, errors: gErrors } = parseGrammar(rulesText, startSymbol);
    if (gErrors.length > 0) { setErrors(gErrors); return; }
    setErrors([]);

    if (mode === 'derivation') {
      const fn = derivationType === 'leftmost' ? deriveLeftmost : deriveRightmost;
      const { steps: s, success, message } = fn(grammar, inputString);
      setSteps(s);
      setResult({ success, message });
      if (success) {
        const tree = buildParseTree(grammar, s);
        setParseTreeRoot(tree);
      }
      setCurrentStep(-1);
    } else if (mode === 'parse-tree') {
      const { steps: s, success, message } = deriveLeftmost(grammar, inputString);
      setSteps(s);
      setResult({ success, message });
      if (success) {
        const tree = buildParseTree(grammar, s);
        setParseTreeRoot(tree);
      }
    } else if (mode === 'ambiguity') {
      const a = detectAmbiguity(grammar, inputString);
      setAmbiguityResult(a);
    } else if (mode === 'simplify') {
      const s = simplifyGrammar(grammar);
      setSimplifySteps(s);
      setSimplifyIdx(0);
    } else if (mode === 'membership') {
      const r = cykMembership(grammar, inputString);
      setCykResult(r);
    } else if (mode === 'pumping') {
      const r = simulatePumpingLemma(grammar, inputString, pumpingLength);
      setPumpingResult(r);
    }
  }, [rulesText, startSymbol, inputString, derivationType, mode, pumpingLength, reset]);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  }, [steps.length]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, -1));
  }, []);

  const toggleAutoRun = useCallback(() => {
    if (isRunning) {
      setIsRunning(false);
      if (autoRunRef.current) clearInterval(autoRunRef.current);
    } else {
      setIsRunning(true);
      autoRunRef.current = window.setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= steps.length - 1) {
            setIsRunning(false);
            clearInterval(autoRunRef.current!);
            return prev;
          }
          return prev + 1;
        });
      }, 700);
    }
  }, [isRunning, steps.length]);

  useEffect(() => () => { if (autoRunRef.current) clearInterval(autoRunRef.current); }, []);

  const displayedSentential = currentStep === -1
    ? startSymbol
    : steps[currentStep]?.sentential ?? startSymbol;

  const modeButtons: { id: SimMode; label: string; icon: React.ReactNode }[] = [
    { id: 'derivation', label: 'Derivation', icon: <ChevronRight size={13} /> },
    { id: 'parse-tree', label: 'Parse Tree', icon: <TreePine size={13} /> },
    { id: 'ambiguity', label: 'Ambiguity', icon: <Diff size={13} /> },
    { id: 'simplify', label: 'Simplify/CNF', icon: <Wrench size={13} /> },
    { id: 'membership', label: 'Membership', icon: <Info size={13} /> },
    { id: 'pumping', label: 'Pumping Lemma', icon: <Beaker size={13} /> },
  ];

  const rulesDisplay = (rules: { lhs: string; rhs: string[] }[]) =>
    rules.map(r => `${r.lhs} → ${r.rhs.map(p => p || 'ε').join(' | ')}`).join('\n');

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
          <TreePine size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">CFG Simulator</h1>
          <p className="text-white/40 text-sm">Context Free Grammar · Derivations, Parse Trees, Simplification</p>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {modeButtons.map(b => (
          <button
            key={b.id}
            onClick={() => { setMode(b.id); reset(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              mode === b.id
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'glass text-white/50 hover:text-white/80'
            }`}
          >
            {b.icon}{b.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Input Panel */}
        <div className="xl:col-span-1 space-y-4">
          {/* Examples */}
          <div className="section-card">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={14} className="text-emerald-400" />
              <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Examples</span>
            </div>
            <div className="space-y-1.5">
              {EXAMPLE_GRAMMARS.map((ex) => (
                <button
                  key={ex.name}
                  onClick={() => loadExample(ex)}
                  className="w-full text-left px-3 py-2 rounded-lg glass-hover text-xs"
                >
                  <div className="font-semibold text-white/80">{ex.name}</div>
                  <div className="text-white/40 mt-0.5">{ex.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Grammar Input */}
          <div className="section-card space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Grammar Definition</span>
            </div>
            <div>
              <label className="label">Production Rules</label>
              <textarea
                className="input-field h-28 resize-none"
                value={rulesText}
                onChange={e => setRulesText(e.target.value)}
                placeholder="S -> aSb | ε&#10;A -> aA | a"
              />
              <p className="text-white/30 text-xs mt-1">One rule per line. Use | for alternatives. Use ε for empty.</p>
            </div>
            <div>
              <label className="label">Start Symbol</label>
              <input className="input-field" value={startSymbol} onChange={e => setStartSymbol(e.target.value)} placeholder="S" />
            </div>
            <div>
              <label className="label">Input String</label>
              <input className="input-field" value={inputString} onChange={e => setInputString(e.target.value)} placeholder="aabb" />
              <p className="text-white/30 text-xs mt-1">Enter ε for empty string</p>
            </div>

            {mode === 'derivation' && (
              <div>
                <label className="label">Derivation Type</label>
                <div className="flex gap-2">
                  {(['leftmost', 'rightmost'] as const).map(t => (
                    <button key={t} onClick={() => setDerivationType(t)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${derivationType === t ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'glass text-white/50'}`}>
                      {t === 'leftmost' ? 'Leftmost' : 'Rightmost'}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {mode === 'pumping' && (
              <div>
                <label className="label">Pumping Length (p)</label>
                <input type="number" className="input-field" value={pumpingLength} onChange={e => setPumpingLength(+e.target.value)} min={1} max={20} />
              </div>
            )}

            {errors.length > 0 && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                {errors.map((e, i) => <p key={i} className="text-red-400 text-xs">{e}</p>)}
              </div>
            )}

            <button onClick={simulate} className="btn-primary w-full justify-center">
              <Play size={14} /> Run Simulation
            </button>
          </div>
        </div>

        {/* Right: Visualization Panel */}
        <div className="xl:col-span-2 space-y-4">
          {/* Derivation Mode */}
          {mode === 'derivation' && (
            <>
              {/* Current Sentential Form */}
              <div className="section-card">
                <p className="label mb-2">Current Sentential Form</p>
                <div className="flex items-center justify-center py-4 px-6 rounded-lg bg-black/30 border border-white/5 min-h-16">
                  <motion.span
                    key={displayedSentential}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl font-mono font-bold text-white tracking-wider"
                  >
                    {displayedSentential || 'ε'}
                  </motion.span>
                </div>
                {currentStep >= 0 && steps[currentStep] && (
                  <div className="mt-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <p className="text-xs font-semibold text-emerald-400 mb-1">Applied: {steps[currentStep].rule}</p>
                    <p className="text-xs text-white/50">{steps[currentStep].explanation}</p>
                  </div>
                )}
              </div>

              {/* Controls */}
              {steps.length > 0 && (
                <div className="section-card">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentStep(-1)} className="btn-secondary" disabled={currentStep === -1}>
                      <SkipBack size={14} />
                    </button>
                    <button onClick={prevStep} className="btn-secondary" disabled={currentStep <= -1}>
                      ‹ Prev
                    </button>
                    <button onClick={toggleAutoRun} className={isRunning ? 'btn-accent' : 'btn-primary'}>
                      {isRunning ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Auto Run</>}
                    </button>
                    <button onClick={nextStep} className="btn-secondary" disabled={currentStep >= steps.length - 1}>
                      Next ›
                    </button>
                    <button onClick={() => setCurrentStep(steps.length - 1)} className="btn-secondary">
                      <SkipForward size={14} />
                    </button>
                    <button onClick={reset} className="btn-secondary ml-auto">
                      <RotateCcw size={14} /> Reset
                    </button>
                  </div>
                  <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      animate={{ width: steps.length > 0 ? `${((currentStep + 1) / steps.length) * 100}%` : '0%' }}
                    />
                  </div>
                  <p className="text-xs text-white/30 mt-1">Step {Math.max(0, currentStep + 1)} / {steps.length}</p>
                </div>
              )}

              {/* Result */}
              {result && (
                <div className={`section-card border ${result.success ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                  <p className={`font-bold text-sm ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {result.success ? '✓ Derivation Successful' : '✗ Derivation Failed'}
                  </p>
                  {result.message && <p className="text-white/50 text-xs mt-1">{result.message}</p>}
                </div>
              )}

              {/* Derivation Steps Table */}
              {steps.length > 0 && (
                <div className="section-card overflow-x-auto">
                  <p className="label mb-3">Derivation Sequence</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-2 px-2 text-white/40 font-semibold w-10">#</th>
                        <th className="text-left py-2 px-2 text-white/40 font-semibold">Sentential Form</th>
                        <th className="text-left py-2 px-2 text-white/40 font-semibold">Rule Applied</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-white/5">
                        <td className="py-2 px-2 text-white/30">0</td>
                        <td className="py-2 px-2 font-mono text-primary-300">{startSymbol}</td>
                        <td className="py-2 px-2 text-white/30 italic">Start</td>
                      </tr>
                      {steps.map((s, i) => (
                        <motion.tr
                          key={i}
                          className={`border-b border-white/5 cursor-pointer transition-colors ${i === currentStep ? 'bg-emerald-500/10' : 'hover:bg-white/3'}`}
                          onClick={() => setCurrentStep(i)}
                          animate={i === currentStep ? { backgroundColor: 'rgba(16,185,129,0.1)' } : {}}
                        >
                          <td className="py-2 px-2 text-white/30">{i + 1}</td>
                          <td className="py-2 px-2 font-mono text-white">{s.sentential || 'ε'}</td>
                          <td className="py-2 px-2 text-emerald-400/80">{s.rule}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Parse Tree Mode */}
          {mode === 'parse-tree' && (
            <>
              <button onClick={simulate} className="btn-primary">
                <Play size={14} /> Generate Parse Tree
              </button>
              {parseTreeRoot && (
                <div className="section-card overflow-auto">
                  <p className="label mb-4">Parse Tree for "{inputString}"</p>
                  <div className="flex justify-center py-4 overflow-x-auto">
                    <ParseTreeViz node={parseTreeRoot} />
                  </div>
                </div>
              )}
              {result && !result.success && (
                <div className="section-card border border-red-500/30 bg-red-500/5">
                  <p className="text-red-400 text-sm font-bold">✗ {result.message}</p>
                </div>
              )}
            </>
          )}

          {/* Ambiguity Mode */}
          {mode === 'ambiguity' && (
            <>
              <button onClick={simulate} className="btn-primary">
                <Play size={14} /> Detect Ambiguity
              </button>
              {ambiguityResult && (
                <>
                  <div className={`section-card border ${ambiguityResult.isAmbiguous ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
                    <p className={`font-bold text-sm ${ambiguityResult.isAmbiguous ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {ambiguityResult.isAmbiguous ? '⚠ Grammar is AMBIGUOUS' : '✓ No Ambiguity Detected'}
                    </p>
                    <p className="text-white/50 text-xs mt-1">{ambiguityResult.explanation}</p>
                  </div>
                  {ambiguityResult.isAmbiguous && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[ambiguityResult.derivation1, ambiguityResult.derivation2].map((d, idx) => (
                        <div key={idx} className="section-card">
                          <p className="label mb-2">Derivation {idx + 1} ({idx === 0 ? 'Leftmost' : 'Rightmost'})</p>
                          <div className="space-y-1">
                            {d.map((s, i) => (
                              <div key={i} className="text-xs font-mono flex gap-2">
                                <span className="text-white/30 w-6">{i + 1}.</span>
                                <span className="text-white">{s.sentential}</span>
                                <span className="text-emerald-400/60 ml-auto">{s.rule}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Simplify / CNF Mode */}
          {mode === 'simplify' && (
            <>
              <button onClick={simulate} className="btn-primary">
                <Play size={14} /> Start Simplification
              </button>
              {simplifySteps.length > 0 && (
                <>
                  <div className="flex gap-2 flex-wrap">
                    {simplifySteps.map((s, i) => (
                      <button key={i} onClick={() => setSimplifyIdx(i)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${simplifyIdx === i ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'glass text-white/50'}`}>
                        {i + 1}. {s.name}
                      </button>
                    ))}
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={simplifyIdx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="section-card"
                    >
                      <p className="text-sm font-bold text-emerald-400 mb-1">Step {simplifyIdx + 1}: {simplifySteps[simplifyIdx].name}</p>
                      <p className="text-xs text-white/50 mb-4">{simplifySteps[simplifyIdx].description}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="label mb-2">Before</p>
                          <pre className="text-xs font-mono text-white/60 bg-black/20 rounded-lg p-3 whitespace-pre-wrap">
                            {rulesDisplay(simplifySteps[simplifyIdx].before)}
                          </pre>
                        </div>
                        <div>
                          <p className="label mb-2">After</p>
                          <pre className="text-xs font-mono text-emerald-300 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 whitespace-pre-wrap">
                            {rulesDisplay(simplifySteps[simplifyIdx].after)}
                          </pre>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </>
              )}
            </>
          )}

          {/* Membership / CYK Mode */}
          {mode === 'membership' && (
            <>
              <button onClick={simulate} className="btn-primary">
                <Play size={14} /> Test Membership (CYK)
              </button>
              {cykResult && (
                <>
                  <div className={`section-card border ${cykResult.accepted ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                    <p className={`font-bold text-sm ${cykResult.accepted ? 'text-emerald-400' : 'text-red-400'}`}>
                      {cykResult.accepted ? `✓ "${inputString}" ∈ L(G) — Accepted` : `✗ "${inputString}" ∉ L(G) — Rejected`}
                    </p>
                  </div>
                  <div className="section-card">
                    <p className="label mb-3">CYK Table Computation</p>
                    <div className="space-y-1">
                      {cykResult.explanation.map((line, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className="text-white/20 font-mono w-4">{i + 1}</span>
                          <span className={line.includes('✓') ? 'text-emerald-400' : line.includes('✗') ? 'text-red-400' : 'text-white/60'}>{line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Pumping Lemma Mode */}
          {mode === 'pumping' && (
            <>
              <button onClick={simulate} className="btn-primary">
                <Beaker size={14} /> Simulate Pumping
              </button>
              {pumpingResult && (
                <div className="section-card">
                  <p className="label mb-3">Pumping Lemma Simulation</p>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {(['u', 'v', 'w'] as const).map(part => (
                      <div key={part} className="rounded-lg bg-black/20 p-3 text-center border border-white/5">
                        <p className="text-xs text-white/40 mb-1 font-semibold uppercase">{part}</p>
                        <p className="text-lg font-mono font-bold text-white">"{pumpingResult.parts[part] || 'ε'}"</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 mb-4">
                    <p className="text-xs font-semibold text-white/60">Pumped Strings:</p>
                    {Object.entries(pumpingResult.pumped).map(([k, s]) => (
                      <div key={k} className="flex items-center gap-3 text-xs">
                        <span className="text-white/30 w-16">pump({k}):</span>
                        <span className="font-mono text-white bg-black/30 px-2 py-0.5 rounded">{s || 'ε'}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {pumpingResult.explanation.map((line, i) => (
                      <p key={i} className="text-xs text-white/50">{line}</p>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
