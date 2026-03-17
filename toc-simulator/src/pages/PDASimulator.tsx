import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, SkipForward, SkipBack, RotateCcw, Pause, Layers, BookOpen, RefreshCw } from 'lucide-react';
import {
  parsePDADefinition,
  simulatePDA,
  cfgToPDA,
  type PDAStep,
  type PDADefinition,
} from '../engine/pda/PDAEngine';
import { parseGrammar as parseCFGGrammar } from '../engine/cfg/CFGEngine';

const PDA_EXAMPLES = [
  {
    name: 'aⁿbⁿ Recognizer',
    description: 'Accepts strings with equal a\'s and b\'s',
    input: 'aaabbb',
    definition: `# PDA for a^n b^n
states: q0,q1,q2
input: a,b
stack: A,Z
start: q0
initial_stack: Z
accept: q2
δ(q0,a,Z) = (q0,AZ)
δ(q0,a,A) = (q0,AA)
δ(q0,b,A) = (q1,ε)
δ(q1,b,A) = (q1,ε)
δ(q1,ε,Z) = (q2,Z)`,
  },
  {
    name: 'Palindrome Checker',
    description: 'Accepts palindromes over {a,b}',
    input: 'abcba',
    definition: `# PDA for palindromes over {a,b,c}
states: q0,q1,q2
input: a,b,c
stack: A,B,C,Z
start: q0
initial_stack: Z
accept: q2
δ(q0,a,ε) = (q0,A)
δ(q0,b,ε) = (q0,B)
δ(q0,c,ε) = (q1,ε)
δ(q0,ε,ε) = (q1,ε)
δ(q1,a,A) = (q1,ε)
δ(q1,b,B) = (q1,ε)
δ(q1,ε,Z) = (q2,Z)`,
  },
  {
    name: 'Balanced Brackets',
    description: 'Accepts balanced ( and )',
    input: '(()())',
    definition: `# PDA for balanced parentheses
states: q0,q1
input: (,)
stack: P,Z
start: q0
initial_stack: Z
accept: q1
δ(q0,(,ε) = (q0,P)
δ(q0,),P) = (q0,ε)
δ(q0,ε,Z) = (q1,Z)`,
  },
];

function StackViz({ stack, prevStack }: { stack: string[]; prevStack: string[] }) {
  return (
    <div className="flex flex-col items-center gap-1 min-h-32">
      <p className="text-xs text-white/30 mb-1">↑ Top</p>
      <AnimatePresence>
        {stack.length === 0 ? (
          <div className="text-white/20 text-xs italic">Empty Stack</div>
        ) : (
          stack.slice(0, 8).map((sym, i) => {
            const isNew = i < prevStack.length ? sym !== prevStack[i] : true;
            return (
              <motion.div
                key={`${sym}-${i}`}
                initial={{ opacity: 0, scale: 0.8, x: isNew ? 20 : 0 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: -20 }}
                className={`w-12 h-8 flex items-center justify-center rounded border font-mono text-sm font-bold transition-all ${
                  i === 0
                    ? 'border-primary-500/60 bg-primary-500/20 text-primary-300 ring-1 ring-primary-500/30'
                    : isNew
                    ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
                    : 'border-white/15 bg-white/5 text-white/70'
                }`}
              >
                {sym}
              </motion.div>
            );
          })
        )}
      </AnimatePresence>
      {stack.length > 8 && <p className="text-white/30 text-xs">...+{stack.length - 8} more</p>}
      <div className="w-12 h-1 bg-white/10 rounded mt-1" />
      <p className="text-xs text-white/20">Bottom</p>
    </div>
  );
}

export default function PDASimulator() {
  const [definition, setDefinition] = useState(PDA_EXAMPLES[0].definition);
  const [inputString, setInputString] = useState(PDA_EXAMPLES[0].input);
  const [acceptMode, setAcceptMode] = useState<'final-state' | 'empty-stack'>('final-state');
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<PDAStep[]>([]);
  const [pda, setPda] = useState<PDADefinition | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ accepted: boolean; message: string } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [cfgMode, setCfgMode] = useState(false);
  const [cfgText, setCfgText] = useState('S -> aSb | ε');
  const [cfgStart, setCfgStart] = useState('S');
  const [cfgConversionSteps, setCfgConversionSteps] = useState<string[]>([]);

  const autoRunRef = useRef<number | null>(null);

  const loadExample = (ex: typeof PDA_EXAMPLES[0]) => {
    setDefinition(ex.definition);
    setInputString(ex.input);
    reset();
  };

  const reset = useCallback(() => {
    setSteps([]);
    setCurrentStep(0);
    setIsRunning(false);
    setResult(null);
    setSimulated(false);
    setPda(null);
    setErrors([]);
    setCfgConversionSteps([]);
    if (autoRunRef.current) clearInterval(autoRunRef.current);
  }, []);

  const simulate = useCallback(() => {
    reset();
    if (cfgMode) {
      // CFG to PDA conversion
      const { grammar, errors: gErrors } = parseCFGGrammar(cfgText, cfgStart);
      if (gErrors.length > 0) { setErrors(gErrors); return; }
      const { pda: convertedPda, steps: convSteps } = cfgToPDA(grammar);
      setCfgConversionSteps(convSteps);
      setPda(convertedPda);
      const trace = simulatePDA(convertedPda, inputString, 'empty-stack');
      setSteps(trace.steps);
      setResult({ accepted: trace.accepted, message: trace.message });
      setSimulated(true);
      setCurrentStep(0);
      return;
    }
    const { pda: parsedPda, errors: parseErrors } = parsePDADefinition(definition);
    if (parseErrors.length > 0) { setErrors(parseErrors); return; }
    setErrors([]);
    setPda(parsedPda!);
    const trace = simulatePDA(parsedPda!, inputString, acceptMode);
    setSteps(trace.steps);
    setResult({ accepted: trace.accepted, message: trace.message });
    setSimulated(true);
    setCurrentStep(0);
  }, [definition, inputString, acceptMode, cfgMode, cfgText, cfgStart, reset]);

  const toggleAutoRun = useCallback(() => {
    if (isRunning) {
      setIsRunning(false);
      clearInterval(autoRunRef.current!);
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
      }, 800);
    }
  }, [isRunning, steps.length]);

  const curStep = steps[currentStep];
  const prevStep = currentStep > 0 ? steps[currentStep - 1] : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center">
          <Layers size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">PDA Simulator</h1>
          <p className="text-white/40 text-sm">Pushdown Automata · Stack Visualization · Nondeterministic Paths</p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        {[
          { id: false, label: 'PDA Definition' },
          { id: true, label: 'CFG → PDA Conversion' },
        ].map(({ id, label }) => (
          <button key={String(id)} onClick={() => { setCfgMode(id); reset(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              cfgMode === id ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' : 'glass text-white/50'
            }`}>
            {id ? <RefreshCw size={12} /> : <Layers size={12} />}{label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="xl:col-span-1 space-y-4">
          {!cfgMode && (
            <div className="section-card">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={14} className="text-primary-400" />
                <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Examples</span>
              </div>
              <div className="space-y-1.5">
                {PDA_EXAMPLES.map(ex => (
                  <button key={ex.name} onClick={() => loadExample(ex)}
                    className="w-full text-left px-3 py-2 rounded-lg glass-hover text-xs">
                    <div className="font-semibold text-white/80">{ex.name}</div>
                    <div className="text-white/40 mt-0.5">{ex.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="section-card space-y-3">
            {cfgMode ? (
              <>
                <p className="text-xs font-bold text-white/60 uppercase tracking-wider">CFG → PDA</p>
                <div>
                  <label className="label">CFG Rules</label>
                  <textarea className="input-field h-24 resize-none" value={cfgText} onChange={e => setCfgText(e.target.value)} placeholder="S -> aSb | ε" />
                </div>
                <div>
                  <label className="label">Start Symbol</label>
                  <input className="input-field" value={cfgStart} onChange={e => setCfgStart(e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <p className="text-xs font-bold text-white/60 uppercase tracking-wider">PDA Definition</p>
                <div>
                  <label className="label">Transition Function</label>
                  <textarea className="input-field h-48 resize-none font-mono text-xs" value={definition} onChange={e => setDefinition(e.target.value)} />
                  <p className="text-white/25 text-xs mt-1">Format: δ(state,input,stackTop) = (newState,push)</p>
                </div>
                <div>
                  <label className="label">Acceptance Mode</label>
                  <div className="flex gap-2">
                    {(['final-state', 'empty-stack'] as const).map(m => (
                      <button key={m} onClick={() => setAcceptMode(m)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${acceptMode === m ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' : 'glass text-white/50'}`}>
                        {m === 'final-state' ? 'Final State' : 'Empty Stack'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="label">Input String</label>
              <input className="input-field" value={inputString} onChange={e => setInputString(e.target.value)} placeholder="aaabbb" />
            </div>
            {errors.length > 0 && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                {errors.map((e, i) => <p key={i} className="text-red-400 text-xs">{e}</p>)}
              </div>
            )}
            <button onClick={simulate} className="btn-primary w-full justify-center">
              <Play size={14} /> {cfgMode ? 'Convert & Simulate' : 'Simulate PDA'}
            </button>
          </div>

          {/* CFG Conversion Steps */}
          {cfgConversionSteps.length > 0 && (
            <div className="section-card">
              <p className="label mb-2">Conversion Steps</p>
              <div className="space-y-1">
                {cfgConversionSteps.map((s, i) => (
                  <p key={i} className="text-xs text-white/50 font-mono">{s}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Visualization Panel */}
        <div className="xl:col-span-2 space-y-4">
          {simulated && curStep && (
            <>
              {/* State & Input display */}
              <div className="grid grid-cols-2 gap-4">
                <div className="section-card text-center">
                  <p className="label mb-2">Current State</p>
                  <motion.div
                    key={curStep.config.state}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`text-3xl font-black font-mono ${
                      result?.accepted && currentStep === steps.length - 1 ? 'text-emerald-400' :
                      !result?.accepted && currentStep === steps.length - 1 ? 'text-red-400' :
                      'text-primary-300'
                    }`}
                  >
                    {curStep.config.state}
                  </motion.div>
                  {pda?.acceptStates.includes(curStep.config.state) && (
                    <span className="badge-green mt-2">Accept State</span>
                  )}
                </div>
                <div className="section-card text-center">
                  <p className="label mb-2">Remaining Input</p>
                  <div className="font-mono text-xl font-bold text-white min-h-8 flex items-center justify-center">
                    {curStep.config.remainingInput || <span className="text-white/30 italic text-sm">Empty (ε)</span>}
                  </div>
                </div>
              </div>

              {/* Stack + Explanation */}
              <div className="grid grid-cols-2 gap-4">
                <div className="section-card flex flex-col items-center">
                  <p className="label mb-3 self-start">Stack</p>
                  <StackViz
                    stack={curStep.config.stack}
                    prevStack={prevStep?.config.stack ?? []}
                  />
                </div>
                <div className="section-card">
                  <p className="label mb-2">Applied Transition</p>
                  <div className="space-y-2">
                    {curStep.appliedTransition && (
                      <div className="font-mono text-xs bg-primary-500/10 border border-primary-500/20 rounded-lg p-2 text-primary-300">
                        δ({curStep.appliedTransition.fromState},{curStep.appliedTransition.inputSymbol || 'ε'},{curStep.appliedTransition.stackTop || 'ε'})
                        = ({curStep.appliedTransition.toState},{curStep.appliedTransition.pushSymbols.join('') || 'ε'})
                      </div>
                    )}
                    <p className="text-xs text-white/50 leading-relaxed">{curStep.explanation}</p>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="section-card">
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setCurrentStep(0)} className="btn-secondary" disabled={currentStep === 0}>
                    <SkipBack size={14} />
                  </button>
                  <button onClick={() => setCurrentStep(p => Math.max(0, p - 1))} className="btn-secondary" disabled={currentStep === 0}>
                    ‹ Prev
                  </button>
                  <button onClick={toggleAutoRun} className={isRunning ? 'btn-accent' : 'btn-primary'}>
                    {isRunning ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Auto Run</>}
                  </button>
                  <button onClick={() => setCurrentStep(p => Math.min(steps.length - 1, p + 1))} className="btn-secondary" disabled={currentStep >= steps.length - 1}>
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
                  <motion.div className="h-full bg-gradient-to-r from-primary-500 to-blue-400"
                    animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
                </div>
                <p className="text-xs text-white/30 mt-1">Step {currentStep + 1} / {steps.length}</p>
              </div>

              {/* Result */}
              {result && (
                <div className={`section-card border ${result.accepted ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                  <p className={`font-bold text-sm ${result.accepted ? 'text-emerald-400' : 'text-red-400'}`}>{result.message}</p>
                </div>
              )}

              {/* Trace Table */}
              <div className="section-card overflow-x-auto">
                <p className="label mb-3">Configuration Trace</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      {['Step', 'State', 'Input Remaining', 'Stack (top→bottom)', 'Action'].map(h => (
                        <th key={h} className="text-left py-2 px-2 text-white/40 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {steps.map((s, i) => (
                      <tr key={i}
                        onClick={() => setCurrentStep(i)}
                        className={`border-b border-white/5 cursor-pointer transition-colors ${i === currentStep ? 'bg-primary-500/10' : 'hover:bg-white/3'}`}>
                        <td className="py-2 px-2 text-white/40">{s.stepNum}</td>
                        <td className="py-2 px-2 font-mono font-bold text-primary-300">{s.config.state}</td>
                        <td className="py-2 px-2 font-mono">{s.config.remainingInput || 'ε'}</td>
                        <td className="py-2 px-2 font-mono text-white/70">[{s.config.stack.join(',')}]</td>
                        <td className="py-2 px-2 text-white/50 max-w-48 truncate">{s.explanation.slice(0, 60)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {!simulated && (
            <div className="section-card flex flex-col items-center justify-center py-16 text-center">
              <Layers size={48} className="text-white/10 mb-4" />
              <p className="text-white/30 text-sm">Define your PDA and click Simulate to begin.</p>
              <p className="text-white/20 text-xs mt-2">Nondeterministic paths are explored via BFS.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
