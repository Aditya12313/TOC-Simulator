import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, BookOpen, Cpu, AlertTriangle, ChevronRight } from 'lucide-react';
import {
  parseTMDefinition, simulateTM, TM_EXAMPLES,
  type TMStep, type TMDefinition,
} from '../engine/tm/TMEngine';
import PlaybackBar from '../components/PlaybackBar';

const TAPE_WIN = 17; // visible cells each side of head

function TapeDisplay({ step, blank }: { step: TMStep; blank: string }) {
  // build visible window around head
  const chars = step.tapeSnapshot.split('');
  const headAbs = step.tapeMin + step.headPosition; // absolute tape coord
  const winStart = headAbs - Math.floor(TAPE_WIN / 2);

  const cells: { sym: string; abs: number }[] = [];
  for (let i = winStart; i < winStart + TAPE_WIN + 2; i++) {
    const relToSnap = i - step.tapeMin;
    cells.push({
      sym: relToSnap >= 0 && relToSnap < chars.length ? chars[relToSnap] : blank,
      abs: i,
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Head indicator */}
      <div className="flex" style={{ gap: 0 }}>
        {cells.map(c => (
          <div key={c.abs}
            className={`flex items-center justify-center text-xs font-mono font-bold transition-colors duration-150 ${
              c.abs === headAbs ? '' : 'opacity-0'
            }`}
            style={{ width: 40, color: 'var(--tm)' }}>
            ▼
          </div>
        ))}
      </div>
      {/* Tape */}
      <div className="flex border border-[var(--border)] rounded-lg overflow-hidden"
        style={{ borderRadius: 8 }}>
        {cells.map((c) => (
          <motion.div
            key={c.abs}
            layout
            animate={c.abs === headAbs ? { scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 0.25 }}
            className={`tape-cell ${c.abs === headAbs ? 'active' : ''}`}
          >
            {c.sym}
          </motion.div>
        ))}
      </div>
      {/* Cell indices */}
      <div className="flex" style={{ gap: 0 }}>
        {cells.map((c) => (
          <div key={c.abs} style={{ width: 40 }}
            className="flex items-center justify-center text-[9px] font-mono text-[var(--ink-3)]">
            {c.abs}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TMSimulator() {
  const [definition, setDefinition] = useState(TM_EXAMPLES[0].definition);
  const [inputStr,   setInputStr]   = useState(TM_EXAMPLES[0].input);
  const [tm,         setTm]         = useState<TMDefinition | null>(null);
  const [steps,      setSteps]      = useState<TMStep[]>([]);
  const [curStep,    setCurStep]    = useState(0);
  const [speed,      setSpeed]      = useState(2);
  const [isRunning,  setIsRunning]  = useState(false);
  const [errors,     setErrors]     = useState<string[]>([]);
  const [result,     setResult]     = useState<{ ok: boolean; rejected: boolean; msg: string; loop: boolean } | null>(null);
  const [simulated,  setSimulated]  = useState(false);
  const [shaking,    setShaking]    = useState(false);

  const autoRef = useRef<number | null>(null);
  const traceRef = useRef<HTMLDivElement>(null);
  const speedMs  = [1400, 700, 200][speed - 1];

  const stopAuto = () => { if (autoRef.current) clearInterval(autoRef.current); setIsRunning(false); };
  const resetAll = useCallback(() => {
    stopAuto(); setSteps([]); setCurStep(0); setResult(null); setSimulated(false);
    setTm(null); setErrors([]); setShaking(false);
  }, []);

  const runSim = useCallback(() => {
    resetAll();
    const { tm: parsed, errors: pe } = parseTMDefinition(definition);
    if (pe.length) { setErrors(pe); return; }
    setTm(parsed!);
    const trace = simulateTM(parsed!, inputStr);
    setSteps(trace.steps);
    setResult({ ok: trace.accepted, rejected: trace.rejected, msg: trace.message, loop: trace.loopDetected });
    setSimulated(true); setCurStep(0);
  }, [definition, inputStr, resetAll]);

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

  // Trigger shake on rejection
  useEffect(() => {
    if (result && !result.ok && curStep === steps.length - 1) {
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
    }
  }, [curStep, result]);

  // Scroll trace
  useEffect(() => {
    if (traceRef.current && curStep >= 0) {
      const el = traceRef.current.querySelector(`[data-step="${curStep}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [curStep]);

  const cur = steps[curStep];
  const isAtEnd = curStep === steps.length - 1;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Header tabs */}
      <div className="border-b border-[var(--border)] px-4 py-2 flex items-center gap-3"
        style={{ background: 'var(--surface)' }}>
        <span className="pill pill-tm shrink-0">TM</span>
        <span className="text-xs text-[var(--ink-3)] font-mono">Turing Machine Simulator</span>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Input */}
        <div className="w-64 border-r border-[var(--border)] flex flex-col overflow-y-auto shrink-0"
          style={{ background: 'var(--bg-2)' }}>
          {/* Examples */}
          <div className="p-3 border-b border-[var(--border)]">
            <div className="section-label flex items-center gap-1"><BookOpen size={10}/> Built-in Examples</div>
            <div className="space-y-1">
              {TM_EXAMPLES.map(ex => (
                <button key={ex.name} onClick={() => { setDefinition(ex.definition); setInputStr(ex.input); resetAll(); }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface)] border border-transparent hover:border-[var(--border)] transition-all text-xs">
                  <div className="font-semibold text-[var(--ink)]">{ex.name}</div>
                  <div className="text-[var(--ink-3)] mt-0.5 font-mono text-[10px]">{ex.description}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="p-3 space-y-3 flex-1">
            <div>
              <div className="section-label">Transition Function</div>
              <textarea className="code-input h-56 resize-none" value={definition} onChange={e => setDefinition(e.target.value)}/>
              <p className="text-[10px] text-[var(--ink-3)] mt-1 font-mono">δ(state,sym) = (newState,write,L|R|S)</p>
            </div>
            <div>
              <div className="section-label">Input String</div>
              <input className="code-input-field" value={inputStr} onChange={e => setInputStr(e.target.value)} placeholder="aabb"/>
            </div>
            {errors.length > 0 && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 font-mono space-y-0.5">
                {errors.map((e,i) => <p key={i}>{e}</p>)}
              </div>
            )}
            <button onClick={runSim} className="btn-tm w-full justify-center">
              ▶ Run Machine
            </button>
            {simulated && <button onClick={resetAll} className="btn-outline w-full justify-center"><RotateCcw size={12}/> Reset</button>}
          </div>
        </div>

        {/* CENTER: Tape + state */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-5 dot-grid">
            {simulated && cur ? (
              <div className="space-y-4">
                {/* Tape */}
                <div className={`card p-5 overflow-x-auto ${shaking ? 'animate-shake' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="section-label">Tape</p>
                    <span className="pill pill-tm">head @ {cur.tapeMin + cur.headPosition}</span>
                  </div>
                  <TapeDisplay step={cur} blank={tm?.blankSymbol ?? '_'} />
                </div>

                {/* State / symbol / status */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="card p-4 text-center">
                    <p className="section-label mb-1">State</p>
                    <motion.p key={cur.state} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="text-2xl font-black font-mono"
                      style={{ color: cur.accepted ? 'var(--cfg)' : cur.rejected ? 'var(--tm)' : 'var(--ink)' }}>
                      {cur.state}
                    </motion.p>
                  </div>
                  <div className="card p-4 text-center">
                    <p className="section-label mb-1">Reading</p>
                    <p className="text-2xl font-black font-mono text-[var(--ink)]">
                      {cur.tapeSnapshot[cur.headPosition] ?? tm?.blankSymbol ?? '_'}
                    </p>
                  </div>
                  <div className="card p-4 text-center">
                    <p className="section-label mb-1">Status</p>
                    <p className={`text-sm font-bold ${cur.accepted ? 'text-[var(--cfg)]' : cur.rejected ? 'text-[var(--tm)]' : 'text-[var(--ink-3)]'}`}>
                      {cur.accepted ? '✓ ACCEPTED' : cur.rejected ? '✗ REJECTED' : '● RUNNING'}
                    </p>
                  </div>
                </div>

                {/* Transition applied */}
                {cur.appliedTransition && (
                  <motion.div key={curStep} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                    className="card p-4 border-l-4" style={{ borderLeftColor: 'var(--tm)' }}>
                    <p className="section-label mb-1">Applied Transition</p>
                    <div className="flex items-center gap-2 flex-wrap font-mono text-sm font-bold text-[var(--ink)]">
                      <span>δ({cur.appliedTransition.fromState}, {cur.appliedTransition.readSymbol})</span>
                      <ChevronRight size={14} className="text-[var(--ink-3)]"/>
                      <span>({cur.appliedTransition.toState}, {cur.appliedTransition.writeSymbol}, {cur.appliedTransition.moveDirection})</span>
                    </div>
                    <p className="text-xs text-[var(--ink-3)] font-mono mt-1.5 leading-relaxed">{cur.explanation}</p>
                  </motion.div>
                )}

                {/* Result */}
                {result && isAtEnd && (
                  <AnimatePresence>
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      className={`animate-pop-in ${result.loop ? 'result-warn' : result.ok ? 'result-accept' : 'result-reject'}`}>
                      {result.loop && <AlertTriangle size={14} className="inline mr-1"/>}
                      {result.msg}
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center text-[var(--ink-3)]">
                <Cpu size={40} className="mb-3 opacity-20"/>
                <p className="text-sm">Select an example or define your TM, then click <strong>Run Machine</strong>.</p>
                <p className="text-xs mt-1 font-mono opacity-60">loop detection active · up to 1000 steps</p>
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
            accentClass="btn-tm" accentColor="var(--tm)"
          />
        </div>

        {/* RIGHT: Trace Table */}
        {simulated && steps.length > 0 && (
          <div className="w-72 border-l border-[var(--border)] flex flex-col shrink-0 overflow-hidden"
            style={{ background: 'var(--surface)' }}>
            <div className="p-3 border-b border-[var(--border)]">
              <p className="section-label">Execution Trace</p>
            </div>
            <div className="flex-1 overflow-y-auto" ref={traceRef}>
              <table className="w-full text-xs">
                <thead className="sticky top-0" style={{ background: 'var(--bg-2)' }}>
                  <tr className="border-b border-[var(--border)]">
                    {['#','State','Tape','Head','Result'].map(h => (
                      <th key={h} className="text-left py-1.5 px-2 font-mono text-[10px] text-[var(--ink-3)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {steps.map((s, i) => (
                    <tr key={i} data-step={i} onClick={() => setCurStep(i)}
                      className="border-b border-[var(--border)] cursor-pointer transition-colors"
                      style={curStep === i ? { background: 'var(--tm-bg)' } : {}}>
                      <td className="py-1.5 px-2 font-mono text-[var(--ink-3)]">{s.stepNum}</td>
                      <td className="py-1.5 px-1.5 font-mono font-bold" style={{ color: 'var(--tm)' }}>{s.state}</td>
                      <td className="py-1.5 px-1.5 font-mono text-[var(--ink-2)] max-w-16 truncate text-[10px]">{s.tapeSnapshot||'_'}</td>
                      <td className="py-1.5 px-1.5 font-mono text-[var(--ink-3)] text-[10px]">{s.tapeMin + s.headPosition}</td>
                      <td className="py-1.5 px-1.5">
                        {s.accepted ? <span className="pill pill-cfg">✓</span> :
                         s.rejected ? <span className="pill pill-tm">✗</span> : null}
                      </td>
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
