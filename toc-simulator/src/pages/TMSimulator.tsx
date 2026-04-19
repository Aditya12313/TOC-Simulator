import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  RotateCcw,
  BookOpen,
  Cpu,
  AlertTriangle,
  ChevronRight,
  Search,
  ChevronDown,
  ChevronUp,
  History,
  Binary,
  Languages,
  Calculator,
  Wrench,
} from 'lucide-react';
import {
  parseTMDefinition,
  simulateTMAsync,
  TM_DEFAULT_MAX_STEPS,
  TM_EXAMPLES,
  type TMStep,
  type TMDefinition,
  type TMExample,
  type TMStopReason,
} from '../engine/tm/TMEngine';
import PlaybackBar from '../components/PlaybackBar';

const TAPE_WINDOW_CELLS = 17;

type ExampleGroupId = 'basic' | 'recognizers' | 'arithmetic' | 'utility';

const EXAMPLE_GROUPS: Array<{ id: ExampleGroupId; title: string; icon: typeof Binary; names: string[] }> = [
  {
    id: 'basic',
    title: 'Basic Machines',
    icon: Binary,
    names: ['String reversal', 'Binary increment', 'Even Number of 1s'],
  },
  {
    id: 'recognizers',
    title: 'Language Recognizers',
    icon: Languages,
    names: ['a^n b^n recognizer', 'Palindrome checker'],
  },
  {
    id: 'arithmetic',
    title: 'Arithmetic Machines',
    icon: Calculator,
    names: ['Unary addition', 'Unary Subtraction'],
  },
  {
    id: 'utility',
    title: 'Utility Machines',
    icon: Wrench,
    names: ['String Copier'],
  },
];

const DEFAULT_GROUP_COLLAPSED: Record<ExampleGroupId, boolean> = {
  basic: false,
  recognizers: false,
  arithmetic: false,
  utility: false,
};

function TapeDisplay({ step, blank, animate }: { step: TMStep; blank: string; animate: boolean }) {
  const chars = step.tapeSnapshot.split('');
  const headAbs = step.tapeMin + step.headPosition;
  const winStart = headAbs - Math.floor(TAPE_WINDOW_CELLS / 2);

  const cells: { sym: string; abs: number }[] = [];
  for (let i = winStart; i < winStart + TAPE_WINDOW_CELLS; i++) {
    const relToSnap = i - step.tapeMin;
    cells.push({
      sym: relToSnap >= 0 && relToSnap < chars.length ? chars[relToSnap] : blank,
      abs: i,
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex" style={{ gap: 0 }}>
        {cells.map((c) => (
          <div
            key={c.abs}
            className={`flex items-center justify-center text-xs font-mono font-bold transition-colors duration-150 ${
              c.abs === headAbs ? '' : 'opacity-0'
            }`}
            style={{ width: 40, color: 'var(--tm)' }}
          >
            v
          </div>
        ))}
      </div>

      <div className="flex border border-[var(--border)] rounded-lg overflow-hidden" style={{ borderRadius: 8 }}>
        {cells.map((c) => {
          if (!animate) {
            return (
              <div key={c.abs} className={`tape-cell ${c.abs === headAbs ? 'active' : ''}`}>
                {c.sym}
              </div>
            );
          }

          return (
            <motion.div
              key={c.abs}
              layout
              animate={c.abs === headAbs ? { scale: [1, 1.08, 1] } : {}}
              transition={{ duration: 0.2 }}
              className={`tape-cell ${c.abs === headAbs ? 'active' : ''}`}
            >
              {c.sym}
            </motion.div>
          );
        })}
      </div>

      <div className="flex" style={{ gap: 0 }}>
        {cells.map((c) => (
          <div
            key={c.abs}
            style={{ width: 40 }}
            className="flex items-center justify-center text-[9px] font-mono text-[var(--ink-3)]"
          >
            {c.abs}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TMSimulator() {
  const [activeExample, setActiveExample] = useState<TMExample | null>(TM_EXAMPLES[0]);
  const [exampleSearch, setExampleSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<ExampleGroupId, boolean>>(DEFAULT_GROUP_COLLAPSED);
  const [recentExampleNames, setRecentExampleNames] = useState<string[]>([TM_EXAMPLES[0].name]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [definition, setDefinition] = useState(TM_EXAMPLES[0].definition);
  const [inputStr, setInputStr] = useState(TM_EXAMPLES[0].input);
  const [tm, setTm] = useState<TMDefinition | null>(null);
  const [steps, setSteps] = useState<TMStep[]>([]);
  const [curStep, setCurStep] = useState(0);
  const [speed, setSpeed] = useState(2);
  const [isRunning, setIsRunning] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isFastMode, setIsFastMode] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{
    ok: boolean;
    rejected: boolean;
    msg: string;
    loop: boolean;
    stopReason: TMStopReason;
  } | null>(null);
  const [simulated, setSimulated] = useState(false);

  const autoRef = useRef<number | null>(null);
  const cancelSimRef = useRef(false);
  const traceRef = useRef<HTMLDivElement>(null);
  const speedMs = [1200, 500, 150][speed - 1];

  const stopAuto = useCallback(() => {
    if (autoRef.current !== null) {
      clearInterval(autoRef.current);
      autoRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const startAuto = useCallback(
    (lastIndex: number) => {
      if (lastIndex <= 0) return;
      stopAuto();
      setIsRunning(true);
      autoRef.current = window.setInterval(() => {
        setCurStep((p) => {
          if (p >= lastIndex) {
            stopAuto();
            return p;
          }
          return p + 1;
        });
      }, speedMs);
    },
    [speedMs, stopAuto]
  );

  const resetAll = useCallback(() => {
    stopAuto();
    cancelSimRef.current = true;
    setIsSimulating(false);
    setSteps([]);
    setCurStep(0);
    setResult(null);
    setSimulated(false);
    setTm(null);
    setErrors([]);
  }, [stopAuto]);

  const stopSimulation = useCallback(() => {
    cancelSimRef.current = true;
    stopAuto();
  }, [stopAuto]);

  const runSim = useCallback(
    async (autoStart = false) => {
      resetAll();
      cancelSimRef.current = false;

      const { tm: parsed, errors: pe } = parseTMDefinition(definition);
      if (pe.length) {
        setErrors(pe);
        return null;
      }

      setTm(parsed!);

      if (isFastMode && activeExample && definition.trim() === activeExample.definition.trim() && activeExample.optimizedRun) {
        const optResult = activeExample.optimizedRun(inputStr);
        const snapshot = optResult.tapeSnapshot ?? (inputStr || parsed!.blankSymbol);
        const stopReason: TMStopReason = optResult.accepted ? 'accepted' : 'rejected';
        const finalState = optResult.accepted ? parsed!.acceptState : parsed!.rejectState;
        const max = Math.max(snapshot.length - 1, 0);
        const fastSteps: TMStep[] = [
          {
            stepNum: 0,
            state: finalState,
            tapeSnapshot: snapshot,
            headPosition: 0,
            appliedTransition: null,
            explanation: 'Fast Mode execution (optimized example path).',
            halted: true,
            accepted: optResult.accepted,
            rejected: !optResult.accepted,
            tapeMin: 0,
            tapeMax: max,
          },
        ];

        setSteps(fastSteps);
        setResult({
          ok: optResult.accepted,
          rejected: !optResult.accepted,
          msg: optResult.message,
          loop: false,
          stopReason,
        });
        setSimulated(true);
        setCurStep(0);

        return {
          steps: fastSteps,
          accepted: optResult.accepted,
          rejected: !optResult.accepted,
          halted: true,
          message: optResult.message,
          loopDetected: false,
          stopReason,
        };
      }

      setIsSimulating(true);
      const trace = await simulateTMAsync(parsed!, inputStr, TM_DEFAULT_MAX_STEPS, () => {}, () => cancelSimRef.current);
      setIsSimulating(false);

      setSteps(trace.steps);
      setResult({
        ok: trace.accepted,
        rejected: trace.rejected,
        msg: trace.message,
        loop: trace.loopDetected,
        stopReason: trace.stopReason,
      });
      setSimulated(true);
      setCurStep(isFastMode ? Math.max(trace.steps.length - 1, 0) : 0);

      if (autoStart && !isFastMode && trace.steps.length > 1 && trace.stopReason !== 'stopped') {
        startAuto(trace.steps.length - 1);
      }

      return trace;
    },
    [definition, inputStr, isFastMode, activeExample, resetAll, startAuto]
  );

  const handleRun = useCallback(async () => {
    if (isSimulating) return;

    if (isFastMode) {
      await runSim(false);
      return;
    }

    if (!simulated) {
      await runSim(true);
      return;
    }

    if (curStep >= steps.length - 1) {
      setCurStep(0);
    }
    startAuto(steps.length - 1);
  }, [isSimulating, isFastMode, runSim, simulated, curStep, steps.length, startAuto]);

  const handleStep = useCallback(async () => {
    if (isFastMode || isSimulating) return;
    stopAuto();

    if (!simulated) {
      const trace = await runSim(false);
      if (trace && trace.steps.length > 1) {
        setCurStep(1);
      }
      return;
    }

    setCurStep((p) => Math.min(steps.length - 1, p + 1));
  }, [isFastMode, isSimulating, simulated, runSim, steps.length, stopAuto]);

  const handlePause = useCallback(() => {
    if (isSimulating) {
      stopSimulation();
      return;
    }
    stopAuto();
  }, [isSimulating, stopAuto, stopSimulation]);

  const togglePlay = useCallback(() => {
    if (isRunning) {
      stopAuto();
      return;
    }

    if (!simulated || steps.length === 0) return;

    if (curStep >= steps.length - 1) {
      setCurStep(0);
    }
    startAuto(steps.length - 1);
  }, [isRunning, simulated, steps.length, curStep, startAuto, stopAuto]);

  useEffect(
    () => () => {
      cancelSimRef.current = true;
      stopAuto();
    },
    [stopAuto]
  );

  useEffect(() => {
    if (traceRef.current && curStep >= 0) {
      const el = traceRef.current.querySelector(`[data-step="${curStep}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [curStep]);

  const executionStatus = isSimulating || isRunning
    ? 'Running'
    : !simulated
      ? 'Idle'
      : result?.stopReason === 'loop'
        ? 'Loop Detected'
        : 'Halted';

  const cur = steps[curStep];
  const isAtEnd = curStep === steps.length - 1;
  const shouldShake = result?.stopReason === 'rejected' && isAtEnd;
  const statusPillClass = executionStatus === 'Running'
    ? 'pill-pda'
    : executionStatus === 'Loop Detected'
      ? 'pill-tm'
      : 'pill-gray';

  const loadExample = useCallback((example: TMExample) => {
    setDefinition(example.definition);
    setInputStr(example.input);
    setActiveExample(example);
    setRecentExampleNames((prev) => [example.name, ...prev.filter((name) => name !== example.name)].slice(0, 3));
    resetAll();
  }, [resetAll]);

  const toggleGroup = useCallback((groupId: ExampleGroupId) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const searchTerm = exampleSearch.trim().toLowerCase();
  const filteredBySearch = TM_EXAMPLES.filter((ex) => ex.name.toLowerCase().includes(searchTerm));
  const groupedExamples = EXAMPLE_GROUPS.map((group) => ({
    ...group,
    examples: filteredBySearch.filter((ex) => group.names.includes(ex.name)),
  }));
  const recentExamples = recentExampleNames
    .map((name) => TM_EXAMPLES.find((ex) => ex.name === name))
    .filter((ex): ex is TMExample => Boolean(ex));

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      <div className="border-b border-[var(--border)] px-4 py-2 flex items-center gap-3" style={{ background: 'var(--surface)' }}>
        <span className="pill pill-tm shrink-0">TM</span>
        <span className="text-xs text-[var(--ink-3)] font-mono">Turing Machine Simulator</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 border-r border-[var(--border)] flex flex-col shrink-0" style={{ background: 'var(--bg-2)' }}>
          <div className="p-3 border-b border-[var(--border)]">
            <div className="section-label flex items-center gap-1 mb-2"><BookOpen size={10} /> Example Explorer</div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
              <input
                value={exampleSearch}
                onChange={(e) => setExampleSearch(e.target.value)}
                placeholder="Search by machine name"
                className="code-input-field pl-7 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="px-3 pt-2 pb-3 border-b border-[var(--border)]">
            <div className="section-label flex items-center gap-1 mb-1.5"><History size={10} /> Recent</div>
            {recentExamples.length > 0 ? (
              <div className="space-y-1.5">
                {recentExamples.map((ex) => (
                  <button
                    key={`recent-${ex.name}`}
                    onClick={() => loadExample(ex)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--tm-border)] hover:bg-[var(--tm-bg)] transition-all"
                  >
                    <p className="text-[11px] font-semibold text-[var(--ink)] truncate">{ex.name}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[10px] font-mono text-[var(--ink-3)]">No recent examples yet.</p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto scroll-smooth px-3 py-2 space-y-2">
            {groupedExamples.map((group) => {
              const GroupIcon = group.icon;
              const isCollapsed = collapsedGroups[group.id];
              return (
                <section key={group.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full px-2.5 py-2 flex items-center justify-between hover:bg-[var(--bg-2)] transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <GroupIcon size={12} className="text-[var(--tm)] shrink-0" />
                      <span className="text-[11px] font-bold text-[var(--ink)] truncate">{group.title}</span>
                      <span className="text-[10px] font-mono text-[var(--ink-3)]">({group.examples.length})</span>
                    </div>
                    {isCollapsed ? <ChevronDown size={13} className="text-[var(--ink-3)]" /> : <ChevronUp size={13} className="text-[var(--ink-3)]" />}
                  </button>

                  {!isCollapsed && (
                    <div className="px-2 pb-2 space-y-1.5 border-t border-[var(--border)]">
                      {group.examples.length === 0 ? (
                        <p className="text-[10px] font-mono text-[var(--ink-3)] px-1 py-1">No matching examples.</p>
                      ) : (
                        group.examples.map((ex) => {
                          const selected = activeExample?.name === ex.name;
                          return (
                            <motion.button
                              key={ex.name}
                              onClick={() => loadExample(ex)}
                              whileHover={{ y: -1 }}
                              whileTap={{ scale: 0.985 }}
                              className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all text-xs mt-1 ${
                                selected
                                  ? 'border-[var(--tm)] bg-[var(--tm-bg)] shadow-sm'
                                  : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--tm-border)] hover:bg-[var(--tm-bg)]'
                              }`}
                            >
                              <div className="font-semibold text-[var(--ink)] truncate">{ex.name}</div>
                              <div className="text-[10px] text-[var(--ink-3)] font-mono truncate">{ex.description}</div>
                            </motion.button>
                          );
                        })
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <div className="p-3 border-t border-[var(--border)] space-y-3">
            <div>
              <div className="section-label">Input String</div>
              <input className="code-input-field" value={inputStr} onChange={(e) => setInputStr(e.target.value)} placeholder="aabb" />
            </div>

            <div className="flex items-center justify-between p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
              <span className="text-xs font-semibold text-[var(--ink)]">Fast Mode</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isFastMode}
                  onChange={(e) => {
                    setIsFastMode(e.target.checked);
                    stopAuto();
                  }}
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--tm)]" />
              </label>
            </div>

            <p className="text-[10px] text-[var(--ink-3)] font-mono">Step limit: {TM_DEFAULT_MAX_STEPS}</p>

            <button
              onClick={() => setIsEditorOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg-2)] transition-colors"
            >
              <span className="text-xs font-semibold text-[var(--ink)]">Machine Definition</span>
              {isEditorOpen ? <ChevronUp size={13} className="text-[var(--ink-3)]" /> : <ChevronDown size={13} className="text-[var(--ink-3)]" />}
            </button>

            {isEditorOpen && (
              <div>
                <textarea className="code-input h-40 resize-none" value={definition} onChange={(e) => setDefinition(e.target.value)} />
                <p className="text-[10px] text-[var(--ink-3)] mt-1 font-mono">d(state,symbol) = (newState,write,L|R|S)</p>
              </div>
            )}

            {errors.length > 0 && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 font-mono space-y-0.5">
                {errors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-5 dot-grid">
            <div className="space-y-4">
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="section-label mb-0">Execution Controls</p>
                  <span className={`pill ${statusPillClass}`}>{executionStatus}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => void handleRun()} disabled={isSimulating} className="btn-tm min-w-24 justify-center">
                    {isFastMode ? 'Fast Run' : 'Run'}
                  </button>
                  <button
                    onClick={() => void handleStep()}
                    disabled={isFastMode || isSimulating}
                    className="btn-outline min-w-24 justify-center"
                  >
                    Step
                  </button>
                  <button
                    onClick={handlePause}
                    disabled={!isRunning && !isSimulating}
                    className="btn-outline min-w-24 justify-center"
                  >
                    Pause
                  </button>
                  <button onClick={resetAll} disabled={!simulated && !isSimulating} className="btn-outline min-w-24 justify-center">
                    <RotateCcw size={12} /> Reset
                  </button>
                </div>

                <p className="text-[10px] font-mono text-[var(--ink-3)] mt-2">
                  {isFastMode ? 'Fast Mode: no animation, final result shown immediately.' : 'Step Mode: smooth tape animation and manual/auto stepping.'}
                </p>

                {result && (
                  <div className={`mt-3 ${result.loop || result.stopReason === 'stepLimit' ? 'result-warn' : result.ok ? 'result-accept' : result.rejected ? 'result-reject' : 'result-warn'}`}>
                    {result.loop && <AlertTriangle size={14} className="inline mr-1" />}
                    {result.msg}
                  </div>
                )}
              </div>

              {activeExample && activeExample.educationalNotes && (
                <motion.div
                  key={activeExample.name}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card p-4 border-l-4"
                  style={{ borderLeftColor: 'var(--tm)' }}
                >
                  <p className="section-label mb-1">Selected Example</p>
                  <p className="text-sm font-bold text-[var(--ink)] mb-1">{activeExample.name}</p>
                  <p className="text-xs text-[var(--ink-3)] leading-relaxed">{activeExample.educationalNotes}</p>
                </motion.div>
              )}

              {simulated && cur ? (
                <>
                  <div className={`card p-5 overflow-x-auto ${shouldShake ? 'animate-shake' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="section-label">Tape</p>
                      <span className="pill pill-tm">head @ {cur.tapeMin + cur.headPosition}</span>
                    </div>
                    <TapeDisplay step={cur} blank={tm?.blankSymbol ?? '_'} animate={!isFastMode} />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="card p-4 text-center">
                      <p className="section-label mb-1">State</p>
                      <motion.p
                        key={cur.state}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-2xl font-black font-mono"
                        style={{ color: cur.accepted ? 'var(--cfg)' : cur.rejected ? 'var(--tm)' : 'var(--ink)' }}
                      >
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
                      <p className="section-label mb-1">Progress</p>
                      <p className="text-sm font-bold text-[var(--ink-3)] font-mono">
                        {steps.length > 0 ? `${curStep + 1}/${steps.length}` : '0/0'}
                      </p>
                    </div>
                  </div>

                  {cur.appliedTransition && !isFastMode && (
                    <motion.div
                      key={curStep}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="card p-4 border-l-4"
                      style={{ borderLeftColor: 'var(--tm)' }}
                    >
                      <p className="section-label mb-1">Applied Transition</p>
                      <div className="flex items-center gap-2 flex-wrap font-mono text-sm font-bold text-[var(--ink)]">
                        <span>d({cur.appliedTransition.fromState}, {cur.appliedTransition.readSymbol})</span>
                        <ChevronRight size={14} className="text-[var(--ink-3)]" />
                        <span>({cur.appliedTransition.toState}, {cur.appliedTransition.writeSymbol}, {cur.appliedTransition.moveDirection})</span>
                      </div>
                      <p className="text-xs text-[var(--ink-3)] font-mono mt-1.5 leading-relaxed">{cur.explanation}</p>
                    </motion.div>
                  )}

                  {result && isAtEnd && (
                    <div className="card p-3">
                      <p className="section-label mb-1">Execution Summary</p>
                      <p className="text-xs font-mono text-[var(--ink-2)]">Final state: {cur.state}</p>
                      <p className="text-xs font-mono text-[var(--ink-2)]">Steps executed: {Math.max(steps.length - 1, 0)}</p>
                      <p className="text-xs font-mono text-[var(--ink-2)]">Stop reason: {result.stopReason}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-56 text-center text-[var(--ink-3)] card">
                  <Cpu size={40} className="mb-3 opacity-20" />
                  <p className="text-sm">Select an example or define your TM, then use Run/Step.</p>
                  <p className="text-xs mt-1 font-mono opacity-60">loop detection active | step limit {TM_DEFAULT_MAX_STEPS}</p>
                </div>
              )}
            </div>
          </div>

          {!isFastMode && (
            <PlaybackBar
              currentStep={simulated ? curStep : -1}
              totalSteps={steps.length}
              isRunning={isRunning}
              speed={speed}
              onFirst={() => setCurStep(0)}
              onPrev={() => setCurStep((p) => Math.max(0, p - 1))}
              onNext={() => setCurStep((p) => Math.min(steps.length - 1, p + 1))}
              onLast={() => setCurStep(Math.max(steps.length - 1, 0))}
              onTogglePlay={togglePlay}
              onSpeedChange={(s) => {
                setSpeed(s);
                stopAuto();
              }}
              accentClass="btn-tm"
              accentColor="var(--tm)"
            />
          )}
        </div>

        {!isFastMode && simulated && steps.length > 0 && (
          <div className="w-72 border-l border-[var(--border)] flex flex-col shrink-0 overflow-hidden" style={{ background: 'var(--surface)' }}>
            <div className="p-3 border-b border-[var(--border)]">
              <p className="section-label">Execution Trace</p>
            </div>
            <div className="flex-1 overflow-y-auto" ref={traceRef}>
              <table className="w-full text-xs">
                <thead className="sticky top-0" style={{ background: 'var(--bg-2)' }}>
                  <tr className="border-b border-[var(--border)]">
                    {['#', 'State', 'Tape', 'Head', 'Result'].map((h) => (
                      <th key={h} className="text-left py-1.5 px-2 font-mono text-[10px] text-[var(--ink-3)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {steps.map((s, i) => (
                    <tr
                      key={i}
                      data-step={i}
                      onClick={() => setCurStep(i)}
                      className="border-b border-[var(--border)] cursor-pointer transition-colors"
                      style={curStep === i ? { background: 'var(--tm-bg)' } : {}}
                    >
                      <td className="py-1.5 px-2 font-mono text-[var(--ink-3)]">{s.stepNum}</td>
                      <td className="py-1.5 px-1.5 font-mono font-bold" style={{ color: 'var(--tm)' }}>
                        {s.state}
                      </td>
                      <td className="py-1.5 px-1.5 font-mono text-[var(--ink-2)] max-w-16 truncate text-[10px]">
                        {s.tapeSnapshot || '_'}
                      </td>
                      <td className="py-1.5 px-1.5 font-mono text-[var(--ink-3)] text-[10px]">{s.tapeMin + s.headPosition}</td>
                      <td className="py-1.5 px-1.5">
                        {s.accepted ? <span className="pill pill-cfg">A</span> : s.rejected ? <span className="pill pill-tm">R</span> : null}
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
