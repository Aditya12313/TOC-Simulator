import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Cpu, BookOpen, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  parseTMDefinition,
  simulateTM,
  TM_EXAMPLES,
  type TMStep,
  type TMDefinition,
} from '../engine/tm/TMEngine';

const TAPE_WINDOW = 15; // number of cells visible

function TapeViz({ step, blankSymbol }: { step: TMStep; blankSymbol: string }) {
  const { tapeSnapshot, headPosition, tapeMin } = step;
  const cells = tapeSnapshot.split('');
  const windowStart = Math.max(0, headPosition - Math.floor(TAPE_WINDOW / 2));
  const windowEnd = windowStart + TAPE_WINDOW;

  const displayCells: { symbol: string; index: number; isHead: boolean }[] = [];
  for (let i = windowStart - 2; i < windowEnd + 2; i++) {
    displayCells.push({
      symbol: i >= 0 && i < cells.length ? cells[i] : blankSymbol,
      index: tapeMin + i,
      isHead: i === headPosition,
    });
  }

  return (
    <div className="overflow-hidden">
      <div className="flex items-end gap-1 justify-center py-4">
        {displayCells.map((cell, i) => (
          <motion.div
            key={`${cell.index}-${i}`}
            layout
            className="flex flex-col items-center gap-1"
          >
            {cell.isHead && (
              <motion.div
                layoutId="head-arrow"
                className="flex flex-col items-center"
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                <div className="text-primary-400 text-xs font-bold">HEAD</div>
                <ChevronRight size={16} className="text-primary-400 rotate-90" />
              </motion.div>
            )}
            <motion.div
              animate={cell.isHead ? {
                scale: [1, 1.1, 1],
                transition: { duration: 0.3 }
              } : {}}
              className={`w-9 h-9 flex items-center justify-center border rounded font-mono text-sm font-bold transition-all duration-200 ${
                cell.isHead
                  ? 'border-primary-500 bg-primary-500/30 text-primary-200 ring-2 ring-primary-500/50'
                  : cell.symbol !== blankSymbol
                  ? 'border-white/20 bg-white/5 text-white/80'
                  : 'border-white/5 bg-transparent text-white/20'
              }`}
            >
              {cell.symbol}
            </motion.div>
            <div className="text-white/20 text-xs font-mono">{cell.index}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function TMSimulator() {
  const [definition, setDefinition] = useState(TM_EXAMPLES[0].definition);
  const [inputString, setInputString] = useState(TM_EXAMPLES[0].input);
  const [steps, setSteps] = useState<TMStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [tm, setTm] = useState<TMDefinition | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ accepted: boolean; rejected: boolean; message: string; loopDetected: boolean } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [speed, setSpeed] = useState(600); // ms between auto steps

  const autoRunRef = useRef<number | null>(null);

  const loadExample = (ex: typeof TM_EXAMPLES[0]) => {
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
    setTm(null);
    setErrors([]);
    if (autoRunRef.current) clearInterval(autoRunRef.current);
  }, []);

  const simulate = useCallback(() => {
    reset();
    const { tm: parsedTm, errors: parseErrors } = parseTMDefinition(definition);
    if (parseErrors.length > 0) { setErrors(parseErrors); return; }
    setErrors([]);
    setTm(parsedTm!);
    const trace = simulateTM(parsedTm!, inputString);
    setSteps(trace.steps);
    setResult({ accepted: trace.accepted, rejected: trace.rejected, message: trace.message, loopDetected: trace.loopDetected });
    setSimulated(true);
    setCurrentStep(0);
  }, [definition, inputString, reset]);

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
      }, speed);
    }
  }, [isRunning, steps.length, speed]);

  useEffect(() => () => { if (autoRunRef.current) clearInterval(autoRunRef.current); }, []);

  const curStep = steps[currentStep];
  const isAtEnd = currentStep === steps.length - 1;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-pink-600 flex items-center justify-center">
          <Cpu size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Turing Machine Simulator</h1>
          <p className="text-white/40 text-sm">Infinite Tape · Head Movement · Halting Conditions · Loop Detection</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="xl:col-span-1 space-y-4">
          <div className="section-card">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={14} className="text-accent-400" />
              <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Built-in Examples</span>
            </div>
            <div className="space-y-1.5">
              {TM_EXAMPLES.map(ex => (
                <button key={ex.name} onClick={() => loadExample(ex)}
                  className="w-full text-left px-3 py-2 rounded-lg glass-hover text-xs">
                  <div className="font-semibold text-white/80">{ex.name}</div>
                  <div className="text-white/40 mt-0.5">{ex.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="section-card space-y-3">
            <p className="text-xs font-bold text-white/60 uppercase tracking-wider">TM Definition</p>
            <div>
              <label className="label">Transition Function</label>
              <textarea className="input-field h-56 resize-none font-mono text-xs" value={definition} onChange={e => setDefinition(e.target.value)} />
              <p className="text-white/25 text-xs mt-1">Format: δ(state,symbol) = (newState,write,L|R|S)</p>
            </div>
            <div>
              <label className="label">Input String</label>
              <input className="input-field" value={inputString} onChange={e => setInputString(e.target.value)} placeholder="aabb" />
            </div>
            <div>
              <label className="label">Auto-run Speed</label>
              <div className="flex gap-2">
                {[{ label: 'Slow', ms: 1200 }, { label: 'Normal', ms: 600 }, { label: 'Fast', ms: 200 }].map(s => (
                  <button key={s.label} onClick={() => setSpeed(s.ms)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${speed === s.ms ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30' : 'glass text-white/50'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            {errors.length > 0 && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                {errors.map((e, i) => <p key={i} className="text-red-400 text-xs">{e}</p>)}
              </div>
            )}
            <button onClick={simulate} className="btn-primary w-full justify-center" style={{ background: 'linear-gradient(135deg, #d946ef, #ec4899)' }}>
              <Play size={14} /> Run Turing Machine
            </button>
          </div>
        </div>

        {/* Visualization */}
        <div className="xl:col-span-2 space-y-4">
          {simulated && curStep ? (
            <>
              {/* Tape Visualization */}
              <div className="section-card overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <p className="label">Tape</p>
                  <span className="badge-blue">Position: {curStep.tapeMin + curStep.headPosition}</span>
                </div>
                <TapeViz step={curStep} blankSymbol={tm?.blankSymbol ?? '_'} />
              </div>

              {/* State Dashboard */}
              <div className="grid grid-cols-3 gap-3">
                <div className="section-card text-center">
                  <p className="label mb-1">State</p>
                  <motion.p key={curStep.state} initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                    className={`text-2xl font-black font-mono ${
                      curStep.accepted ? 'text-emerald-400' :
                      curStep.rejected ? 'text-red-400' : 'text-accent-300'
                    }`}>
                    {curStep.state}
                  </motion.p>
                </div>
                <div className="section-card text-center">
                  <p className="label mb-1">Reading</p>
                  <p className="text-2xl font-mono font-bold text-white">
                    {curStep.tapeSnapshot[curStep.headPosition] ?? tm?.blankSymbol ?? '_'}
                  </p>
                </div>
                <div className="section-card text-center">
                  <p className="label mb-1">Status</p>
                  <p className={`text-sm font-bold ${curStep.accepted ? 'text-emerald-400' : curStep.rejected ? 'text-red-400' : 'text-accent-400'}`}>
                    {curStep.accepted ? 'ACCEPTED' : curStep.rejected ? 'REJECTED' : 'RUNNING'}
                  </p>
                </div>
              </div>

              {/* Applied Transition */}
              {curStep.appliedTransition && (
                <div className="section-card">
                  <p className="label mb-2">Applied Transition</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="font-mono text-sm bg-accent-500/10 border border-accent-500/20 rounded-lg px-3 py-2 text-accent-300">
                      δ({curStep.appliedTransition.fromState}, {curStep.appliedTransition.readSymbol})
                    </div>
                    <ChevronRight size={16} className="text-white/30" />
                    <div className="font-mono text-sm bg-accent-500/10 border border-accent-500/20 rounded-lg px-3 py-2 text-accent-300">
                      ({curStep.appliedTransition.toState}, {curStep.appliedTransition.writeSymbol}, {curStep.appliedTransition.moveDirection})
                    </div>
                  </div>
                  <p className="text-xs text-white/50 mt-2">{curStep.explanation}</p>
                </div>
              )}

              {/* Controls */}
              <div className="section-card">
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setCurrentStep(0)} className="btn-secondary" disabled={currentStep === 0}>
                    <SkipBack size={14} />
                  </button>
                  <button onClick={() => setCurrentStep(p => Math.max(0, p - 1))} className="btn-secondary" disabled={currentStep === 0}>
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <button onClick={toggleAutoRun} disabled={isAtEnd && !isRunning}
                    className={isRunning ? 'btn-accent' : 'btn-primary'} style={!isRunning ? { background: 'linear-gradient(135deg, #d946ef, #ec4899)' } : {}}>
                    {isRunning ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Auto Run</>}
                  </button>
                  <button onClick={() => setCurrentStep(p => Math.min(steps.length - 1, p + 1))} className="btn-secondary" disabled={currentStep >= steps.length - 1}>
                    Next <ChevronRight size={14} />
                  </button>
                  <button onClick={() => setCurrentStep(steps.length - 1)} className="btn-secondary">
                    <SkipForward size={14} />
                  </button>
                  <button onClick={reset} className="btn-secondary ml-auto">
                    <RotateCcw size={14} /> Reset
                  </button>
                </div>
                <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div className="h-full" style={{ background: 'linear-gradient(90deg, #d946ef, #ec4899)' }}
                    animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
                </div>
                <p className="text-xs text-white/30 mt-1">Step {currentStep + 1} / {steps.length}</p>
              </div>

              {/* Result + Loop Warning */}
              <AnimatePresence>
                {result && isAtEnd && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`section-card border ${
                      result.loopDetected ? 'border-yellow-500/30 bg-yellow-500/5' :
                      result.accepted ? 'border-emerald-500/30 bg-emerald-500/5' :
                      'border-red-500/30 bg-red-500/5'
                    }`}>
                    {result.loopDetected && <AlertTriangle size={16} className="text-yellow-400 mb-1" />}
                    <p className={`font-bold text-sm ${result.loopDetected ? 'text-yellow-400' : result.accepted ? 'text-emerald-400' : 'text-red-400'}`}>
                      {result.message}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Trace Table */}
              <div className="section-card overflow-x-auto">
                <p className="label mb-3">Execution Trace</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      {['Step', 'State', 'Tape', 'Head', 'Transition', 'Result'].map(h => (
                        <th key={h} className="text-left py-2 px-2 text-white/40 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {steps.map((s, i) => (
                      <tr key={i} onClick={() => setCurrentStep(i)}
                        className={`border-b border-white/5 cursor-pointer transition-colors ${i === currentStep ? 'bg-accent-500/10' : 'hover:bg-white/3'}`}>
                        <td className="py-1.5 px-2 text-white/40">{s.stepNum}</td>
                        <td className="py-1.5 px-2 font-mono text-accent-300 font-bold">{s.state}</td>
                        <td className="py-1.5 px-2 font-mono text-white/60 max-w-24 truncate">{s.tapeSnapshot || '_'}</td>
                        <td className="py-1.5 px-2 text-white/50">{s.tapeMin + s.headPosition}</td>
                        <td className="py-1.5 px-2 font-mono text-white/50">
                          {s.appliedTransition
                            ? `(${s.appliedTransition.toState},${s.appliedTransition.writeSymbol},${s.appliedTransition.moveDirection})`
                            : '—'}
                        </td>
                        <td className="py-1.5 px-2">
                          {s.accepted ? <span className="badge-green">Accept</span> :
                           s.rejected ? <span className="badge-red">Reject</span> :
                           <span className="text-white/20">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="section-card flex flex-col items-center justify-center py-20 text-center">
              <Cpu size={56} className="text-white/8 mb-4" />
              <p className="text-white/30 text-sm">Select an example or define your TM, then click Run.</p>
              <p className="text-white/20 text-xs mt-2">All 4 built-in examples include acceptance by final state logic.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
