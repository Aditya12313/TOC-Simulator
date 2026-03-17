import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, BookOpen, Layers, RefreshCw } from 'lucide-react';
import {
  parsePDADefinition, simulatePDA, cfgToPDA,
  type PDAStep, type PDADefinition,
} from '../engine/pda/PDAEngine';
import { parseGrammar as parseCFGGrammar } from '../engine/cfg/CFGEngine';
import PlaybackBar from '../components/PlaybackBar';

const PDA_EXAMPLES = [
  {
    name: 'aⁿbⁿ', desc: 'Equal a\'s and b\'s', input: 'aaabbb',
    def: `# PDA for a^n b^n
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
    name: 'Palindrome', desc: 'Palindromes over {a,b,c}', input: 'abcba',
    def: `# PDA for palindromes over {a,b,c}
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
    name: 'Brackets', desc: 'Balanced ( and )', input: '(()())',
    def: `# PDA for balanced parens
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
    <div className="flex flex-col items-center">
      <p className="section-label mb-2 text-center">↑ TOP</p>
      <div className="flex flex-col items-center border-x border-t border-[var(--border)] rounded-t-lg overflow-hidden"
        style={{ minHeight: 80, minWidth: 72 }}>
        <AnimatePresence>
          {stack.length === 0
            ? <div className="w-full h-10 flex items-center justify-center text-[var(--ink-3)] text-xs font-mono italic">empty</div>
            : stack.slice(0, 10).map((sym, i) => {
                const isTop   = i === 0;
                const isFresh = i < prevStack.length ? sym !== prevStack[i] : true;
                return (
                  <motion.div key={`${sym}-${i}`}
                    initial={{ opacity: 0, y: -16, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    className={`stack-cell ${isTop ? 'top' : isFresh ? 'fresh' : ''}`}
                    style={{ width: 72 }}>
                    {sym}
                  </motion.div>
                );
              })}
        </AnimatePresence>
      </div>
      {stack.length > 10 && <p className="text-[10px] text-[var(--ink-3)] font-mono mt-1">+{stack.length-10} more</p>}
      <div className="w-[72px] h-2 border-x border-b border-[var(--border)] rounded-b-lg"
        style={{ background: 'var(--bg-2)' }} />
      <p className="section-label mt-1 text-center">BOTTOM</p>
    </div>
  );
}

export default function PDASimulator() {
  const [definition, setDefinition] = useState(PDA_EXAMPLES[0].def);
  const [inputStr,   setInputStr]   = useState(PDA_EXAMPLES[0].input);
  const [acceptMode, setAcceptMode] = useState<'final-state'|'empty-stack'>('final-state');
  const [isCFGMode,  setIsCFGMode]  = useState(false);
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

  const autoRef = useRef<number|null>(null);
  const logRef  = useRef<HTMLDivElement>(null);
  const speedMs = [1400, 750, 250][speed - 1];

  const stopAuto = () => { if (autoRef.current) clearInterval(autoRef.current); setIsRunning(false); };
  const resetAll = useCallback(() => {
    stopAuto(); setSteps([]); setCurStep(0); setResult(null); setSimulated(false);
    setPda(null); setErrors([]); setCfgConvSteps([]);
  }, []);

  const runSim = useCallback(() => {
    resetAll();
    if (isCFGMode) {
      const { grammar, errors: ge } = parseCFGGrammar(cfgText, cfgStart);
      if (ge.length) { setErrors(ge); return; }
      const { pda: converted, steps: convSteps } = cfgToPDA(grammar);
      setCfgConvSteps(convSteps); setPda(converted);
      const trace = simulatePDA(converted, inputStr, 'empty-stack');
      setSteps(trace.steps); setResult({ ok: trace.accepted, msg: trace.message });
    } else {
      const { pda: parsed, errors: pe } = parsePDADefinition(definition);
      if (pe.length) { setErrors(pe); return; }
      setPda(parsed!);
      const trace = simulatePDA(parsed!, inputStr, acceptMode);
      setSteps(trace.steps); setResult({ ok: trace.accepted, msg: trace.message });
    }
    setSimulated(true); setCurStep(0);
  }, [isCFGMode, cfgText, cfgStart, definition, inputStr, acceptMode, resetAll]);

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

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Mode tabs */}
      <div className="border-b border-[var(--border)] px-4 py-2 flex items-center gap-2"
        style={{ background: 'var(--surface)' }}>
        <span className="pill pill-pda shrink-0">PDA</span>
        <span className="w-px h-4 bg-[var(--border)]" />
        {[
          { id: false, label: 'PDA Definition', icon: <Layers size={11}/> },
          { id: true,  label: 'CFG → PDA',      icon: <RefreshCw size={11}/> },
        ].map(({ id, label, icon }) => (
          <button key={String(id)} onClick={() => { setIsCFGMode(id); resetAll(); }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
              isCFGMode === id ? 'bg-[var(--pda-bg)] text-[var(--pda)] border-[var(--pda-border)]' : 'border-transparent text-[var(--ink-3)] hover:border-[var(--border)]'
            }`}>
            {icon} {label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Input */}
        <div className="w-64 border-r border-[var(--border)] flex flex-col overflow-y-auto shrink-0"
          style={{ background: 'var(--bg-2)' }}>
          {!isCFGMode && (
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
            {isCFGMode ? (
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
                  <div className="section-label">Transitions</div>
                  <textarea className="code-input h-52 resize-none" value={definition} onChange={e => setDefinition(e.target.value)}/>
                  <p className="text-[10px] text-[var(--ink-3)] mt-1 font-mono">δ(state,input,stackTop) = (newState,push)</p>
                </div>
                <div>
                  <div className="section-label">Acceptance Mode</div>
                  <div className="flex gap-1.5">
                    {(['final-state','empty-stack'] as const).map(m => (
                      <button key={m} onClick={() => setAcceptMode(m)}
                        className={`flex-1 py-1 text-[11px] font-semibold border rounded-lg transition-all ${
                          acceptMode === m ? 'bg-[var(--pda-bg)] text-[var(--pda)] border-[var(--pda-border)]' : 'border-[var(--border)] text-[var(--ink-3)]'
                        }`}>{m==='final-state'?'Final State':'Empty Stack'}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div>
              <div className="section-label">Input String</div>
              <input className="code-input-field" value={inputStr} onChange={e => setInputStr(e.target.value)} placeholder="aaabbb"/>
            </div>
            {errors.length > 0 && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 font-mono space-y-0.5">
                {errors.map((e,i) => <p key={i}>{e}</p>)}
              </div>
            )}
            <button onClick={runSim} className="btn-pda w-full justify-center">
              ▶ {isCFGMode ? 'Convert & Simulate' : 'Simulate PDA'}
            </button>
            {simulated && <button onClick={resetAll} className="btn-outline w-full justify-center"><RotateCcw size={12}/> Reset</button>}
          </div>
        </div>

        {/* CENTER: Visualization */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-5 dot-grid">
            {simulated && cur ? (
              <div className="space-y-4">
                {/* State / Input / Stack dashboard */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="card p-4 text-center">
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
                    <StackViz stack={cur.config.stack} prevStack={prev?.config.stack ?? []} />
                  </div>
                </div>

                {/* Transition explanation */}
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
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center text-[var(--ink-3)]">
                <Layers size={40} className="mb-3 opacity-20"/>
                <p className="text-sm">Configure your PDA and click <strong>Simulate</strong>.</p>
                <p className="text-xs mt-1 font-mono opacity-60">nondeterminism explored via BFS</p>
              </div>
            )}
          </div>

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
        </div>

        {/* RIGHT: Trace Table */}
        {simulated && steps.length > 0 && (
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
                  {steps.map((s, i) => (
                    <tr key={i} data-step={i} onClick={() => setCurStep(i)}
                      className="border-b border-[var(--border)] cursor-pointer transition-colors"
                      style={curStep === i ? { background: 'var(--pda-bg)' } : {}}>
                      <td className="py-1.5 px-2 font-mono text-[var(--ink-3)]">{s.stepNum}</td>
                      <td className="py-1.5 px-2 font-mono font-bold" style={{ color: 'var(--pda)' }}>{s.config.state}</td>
                      <td className="py-1.5 px-2 font-mono text-[var(--ink-2)]">{s.config.remainingInput||'ε'}</td>
                      <td className="py-1.5 px-2 font-mono text-[var(--ink-3)]">[{s.config.stack.join(',')||'∅'}]</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
