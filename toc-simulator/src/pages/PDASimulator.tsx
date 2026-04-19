import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  RotateCcw,
  BookOpen,
  Cpu,
  Search,
  History,
  ChevronDown,
  ChevronUp,
  Layers,
  Languages,
  GitBranch,
  AlertTriangle,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  parsePDADefinition,
  simulatePDAAsync,
  PDA_EXAMPLES,
  PDA_DEFAULT_MAX_STEPS,
  type PDAStep,
  type PDAExample,
  type PDAStopReason,
} from '../engine/pda/PDAEngine';

type PDAGroupId = 'basic' | 'recognizers' | 'patterns';

const PDA_GROUPS: Array<{ id: PDAGroupId; title: string; icon: typeof Layers; names: string[] }> = [
  {
    id: 'basic',
    title: 'Basic Machines',
    icon: Layers,
    names: ['Balanced parentheses', "Equal number of a's and b's"],
  },
  {
    id: 'recognizers',
    title: 'Language Recognizers',
    icon: Languages,
    names: ['a^n b^n recognizer', 'Palindrome checker'],
  },
  {
    id: 'patterns',
    title: 'Stack-based Patterns',
    icon: GitBranch,
    names: ['a^n b^m c^m'],
  },
];

const DEFAULT_GROUPS: Record<PDAGroupId, boolean> = {
  basic: false,
  recognizers: false,
  patterns: false,
};

const SPEEDS = [
  { label: '0.5x', value: 1 },
  { label: '1x', value: 2 },
  { label: '2x', value: 3 },
];

function getStackAction(step: PDAStep | null, prevStep: PDAStep | null): string {
  if (!step) return 'None';
  const curr = step.config.stack;
  const prev = prevStep?.config.stack ?? [];

  if (curr.length > prev.length) {
    const pushed = curr.slice(0, curr.length - prev.length).join('') || 'eps';
    return `Push ${pushed}`;
  }

  if (curr.length < prev.length) {
    const popped = prev.slice(0, prev.length - curr.length).join('') || 'eps';
    return `Pop ${popped}`;
  }

  return step.appliedTransition ? 'No stack size change' : 'None';
}

function StackDisplay({ step, prevStep, animate }: { step: PDAStep; prevStep: PDAStep | null; animate: boolean }) {
  const stack = step.config.stack;
  const prev = prevStep?.config.stack ?? [];
  const changedCount = Math.abs(stack.length - prev.length);
  const stackAction = getStackAction(step, prevStep);

  return (
    <div className="flex flex-col items-center">
      <p className="section-label mb-1">Stack (Top)</p>
      <div className="flex flex-col items-center border border-[var(--border)] rounded-lg overflow-hidden min-w-[92px]">
        {stack.length === 0 && (
          <div className="w-full h-10 flex items-center justify-center text-[var(--ink-3)] text-xs font-mono italic bg-[var(--surface)]">
            empty
          </div>
        )}

        {stack.slice(0, 14).map((sym, i) => {
          const isTop = i === 0;
          const isChanged = i < changedCount;
          const cls = `stack-cell w-[92px] ${isTop ? 'top' : isChanged ? 'fresh' : ''}`;

          if (!animate) {
            return (
              <div key={`${sym}-${i}`} className={cls}>
                {sym}
              </div>
            );
          }

          return (
            <motion.div
              key={`${sym}-${i}`}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className={cls}
            >
              {sym}
            </motion.div>
          );
        })}
      </div>
      <p className="text-[10px] text-[var(--ink-3)] font-mono mt-1">{stackAction}</p>
    </div>
  );
}

export default function PDASimulator() {
  const [activeExample, setActiveExample] = useState<PDAExample | null>(PDA_EXAMPLES[0]);
  const [exampleSearch, setExampleSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<PDAGroupId, boolean>>(DEFAULT_GROUPS);
  const [recentExampleNames, setRecentExampleNames] = useState<string[]>([PDA_EXAMPLES[0].name]);
  const [isDefinitionOpen, setIsDefinitionOpen] = useState(false);

  const [definition, setDefinition] = useState(PDA_EXAMPLES[0].definition);
  const [inputStr, setInputStr] = useState(PDA_EXAMPLES[0].input);
  const [acceptMode, setAcceptMode] = useState<'final-state' | 'empty-stack'>('final-state');
  const [isFastMode, setIsFastMode] = useState(false);

  const [steps, setSteps] = useState<PDAStep[]>([]);
  const [curStep, setCurStep] = useState(0);
  const [speed, setSpeed] = useState(2);
  const [isRunning, setIsRunning] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ ok: boolean; msg: string; loop: boolean; stopReason: PDAStopReason } | null>(null);
  const [simulated, setSimulated] = useState(false);

  const autoRef = useRef<number | null>(null);
  const cancelSimRef = useRef(false);
  const traceRef = useRef<HTMLDivElement>(null);
  const speedMs = [1100, 480, 150][speed - 1];

  const stopAuto = useCallback(() => {
    if (autoRef.current !== null) {
      clearInterval(autoRef.current);
      autoRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const startAuto = useCallback((lastIndex: number) => {
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
  }, [speedMs, stopAuto]);

  const resetTimeline = useCallback(() => {
    stopAuto();
    cancelSimRef.current = true;
    setIsSimulating(false);
    setSteps([]);
    setCurStep(0);
    setResult(null);
    setSimulated(false);
    setErrors([]);
  }, [stopAuto]);

  const loadExample = useCallback((example: PDAExample) => {
    setDefinition(example.definition);
    setInputStr(example.input);
    setActiveExample(example);
    setRecentExampleNames((prev) => [example.name, ...prev.filter((name) => name !== example.name)].slice(0, 3));
    resetTimeline();
  }, [resetTimeline]);

  const toggleGroup = useCallback((groupId: PDAGroupId) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const runSimulation = useCallback(async (autoStart = false) => {
    resetTimeline();
    cancelSimRef.current = false;

    const { pda: parsed, errors: parseErrors } = parsePDADefinition(definition);
    if (parseErrors.length) {
      setErrors(parseErrors);
      return null;
    }

    setIsSimulating(true);

    const trace = await simulatePDAAsync(
      parsed!,
      inputStr,
      acceptMode,
      PDA_DEFAULT_MAX_STEPS,
      () => {},
      () => cancelSimRef.current
    );

    setIsSimulating(false);
    setSteps(trace.steps);
    setResult({ ok: trace.accepted, msg: trace.message, loop: trace.loopDetected, stopReason: trace.stopReason });
    setSimulated(true);
    setCurStep(isFastMode ? Math.max(trace.steps.length - 1, 0) : 0);

    if (autoStart && !isFastMode && trace.steps.length > 1 && trace.stopReason !== 'stopped') {
      startAuto(trace.steps.length - 1);
    }

    return trace;
  }, [resetTimeline, definition, inputStr, acceptMode, isFastMode, startAuto]);

  const handleRun = useCallback(async () => {
    if (isSimulating) return;

    if (isFastMode) {
      await runSimulation(false);
      return;
    }

    if (!simulated) {
      await runSimulation(true);
      return;
    }

    if (curStep >= steps.length - 1) {
      setCurStep(0);
    }
    startAuto(steps.length - 1);
  }, [isSimulating, isFastMode, runSimulation, simulated, curStep, steps.length, startAuto]);

  const handleStep = useCallback(async () => {
    if (isFastMode || isSimulating) return;
    stopAuto();

    if (!simulated) {
      const trace = await runSimulation(false);
      if (trace && trace.steps.length > 1) {
        setCurStep(1);
      }
      return;
    }

    setCurStep((p) => Math.min(steps.length - 1, p + 1));
  }, [isFastMode, isSimulating, simulated, runSimulation, steps.length, stopAuto]);

  const handlePause = useCallback(() => {
    if (isSimulating) {
      cancelSimRef.current = true;
      stopAuto();
      return;
    }
    stopAuto();
  }, [isSimulating, stopAuto]);

  useEffect(() => () => {
    cancelSimRef.current = true;
    stopAuto();
  }, [stopAuto]);

  useEffect(() => {
    if (traceRef.current && curStep >= 0) {
      const el = traceRef.current.querySelector(`[data-step="${curStep}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [curStep]);

  const searchTerm = exampleSearch.trim().toLowerCase();
  const filteredExamples = PDA_EXAMPLES.filter((ex) => ex.name.toLowerCase().includes(searchTerm));
  const groupedExamples = PDA_GROUPS.map((group) => ({
    ...group,
    examples: filteredExamples.filter((ex) => group.names.includes(ex.name)),
  }));

  const recentExamples = recentExampleNames
    .map((name) => PDA_EXAMPLES.find((ex) => ex.name === name))
    .filter((ex): ex is PDAExample => Boolean(ex));

  const cur = steps[curStep];
  const prev = curStep > 0 ? steps[curStep - 1] : null;
  const isAtEnd = curStep === steps.length - 1;

  const executionStatus = isSimulating || isRunning
    ? 'Running'
    : !simulated
      ? 'Idle'
      : result?.ok
        ? 'Accepted'
        : result?.stopReason === 'rejected-no-transition' || result?.stopReason === 'rejected'
          ? 'Rejected'
          : 'Halted';

  const statusPillClass = executionStatus === 'Running'
    ? 'pill-pda'
    : executionStatus === 'Accepted'
      ? 'pill-cfg'
      : executionStatus === 'Rejected'
        ? 'pill-tm'
        : 'pill-gray';

  const progress = steps.length > 0 ? ((curStep + 1) / steps.length) * 100 : 0;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      <div className="border-b border-[var(--border)] px-4 py-2 flex items-center gap-3" style={{ background: 'var(--surface)' }}>
        <span className="pill pill-pda shrink-0">PDA</span>
        <span className="text-xs text-[var(--ink-3)] font-mono">Pushdown Automata Simulator</span>
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
                placeholder="Search examples"
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
                    className="w-full text-left px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--pda-border)] hover:bg-[var(--pda-bg)] transition-all"
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
                      <GroupIcon size={12} className="text-[var(--pda)] shrink-0" />
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
                                  ? 'border-[var(--pda)] bg-[var(--pda-bg)] shadow-sm'
                                  : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--pda-border)] hover:bg-[var(--pda-bg)]'
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
              <input className="code-input-field" value={inputStr} onChange={(e) => setInputStr(e.target.value)} placeholder="aaabbb" />
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
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--pda)]" />
              </label>
            </div>

            <div>
              <div className="section-label">Acceptance Mode</div>
              <div className="flex gap-1.5">
                {(['final-state', 'empty-stack'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setAcceptMode(m)}
                    className={`flex-1 py-1 text-[11px] font-semibold border rounded-lg transition-all ${
                      acceptMode === m ? 'bg-[var(--pda-bg)] text-[var(--pda)] border-[var(--pda-border)]' : 'border-[var(--border)] text-[var(--ink-3)]'
                    }`}
                  >
                    {m === 'final-state' ? 'Final State' : 'Empty Stack'}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-[var(--ink-3)] font-mono">Step limit: {PDA_DEFAULT_MAX_STEPS}</p>

            <button
              onClick={() => setIsDefinitionOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg-2)] transition-colors"
            >
              <span className="text-xs font-semibold text-[var(--ink)]">Show Machine Definition</span>
              {isDefinitionOpen ? <ChevronUp size={13} className="text-[var(--ink-3)]" /> : <ChevronDown size={13} className="text-[var(--ink-3)]" />}
            </button>

            {isDefinitionOpen && (
              <div>
                <textarea className="code-input h-40 resize-none" value={definition} onChange={(e) => setDefinition(e.target.value)} />
                <p className="text-[10px] text-[var(--ink-3)] mt-1 font-mono">d(state,input,stackTop) = (newState,push)</p>
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
                  <p className="section-label mb-0">Execution Status</p>
                  <span className={`pill ${statusPillClass}`}>{executionStatus}</span>
                </div>
                <p className="text-[10px] font-mono text-[var(--ink-3)]">
                  {isFastMode
                    ? 'Fast Mode: no stack animation, instant result.'
                    : 'Step Mode: visualize each transition and stack action.'}
                </p>
                {result && (
                  <div className={`mt-3 ${result.loop || result.stopReason === 'stepLimit' ? 'result-warn' : result.ok ? 'result-accept' : 'result-reject'}`}>
                    {result.loop && <AlertTriangle size={14} className="inline mr-1" />}
                    {result.msg}
                  </div>
                )}
              </div>

              {activeExample && (
                <motion.div
                  key={activeExample.name}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card p-4 border-l-4"
                  style={{ borderLeftColor: 'var(--pda)' }}
                >
                  <p className="section-label mb-1">Selected Example</p>
                  <p className="text-sm font-bold text-[var(--ink)] mb-1">{activeExample.name}</p>
                  <p className="text-xs text-[var(--ink-3)] leading-relaxed">{activeExample.educationalNotes}</p>
                </motion.div>
              )}

              {simulated && cur ? (
                <>
                  <div className="card p-5">
                    <div className="grid grid-cols-3 gap-3 items-start">
                      <div className="card p-4 text-center">
                        <p className="section-label mb-1">State</p>
                        <p className="text-2xl font-black font-mono text-[var(--pda)]">{cur.config.state}</p>
                      </div>
                      <div className="card p-4 text-center">
                        <p className="section-label mb-1">Input Remaining</p>
                        <p className="text-xl font-black font-mono text-[var(--ink)] break-all">{cur.config.remainingInput || 'eps'}</p>
                      </div>
                      <div className="card p-4 flex items-center justify-center">
                        <StackDisplay step={cur} prevStep={prev} animate={!isFastMode} />
                      </div>
                    </div>
                  </div>

                  {cur.appliedTransition && (
                    <motion.div
                      key={curStep}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="card p-4 border-l-4"
                      style={{ borderLeftColor: 'var(--pda)' }}
                    >
                      <p className="section-label mb-1">Current Transition</p>
                      <p className="font-mono text-sm font-bold text-[var(--ink)] mb-1.5">
                        d({cur.appliedTransition.fromState}, {cur.appliedTransition.inputSymbol || 'eps'}, {cur.appliedTransition.stackTop || 'eps'})
                        {' = '}
                        ({cur.appliedTransition.toState}, {cur.appliedTransition.pushSymbols.join('') || 'eps'})
                      </p>
                      <p className="text-xs text-[var(--ink-3)] font-mono leading-relaxed">{cur.explanation}</p>
                    </motion.div>
                  )}

                  {result && isAtEnd && (
                    <div className="card p-3">
                      <p className="section-label mb-1">Execution Summary</p>
                      <p className="text-xs font-mono text-[var(--ink-2)]">Final state: {cur.config.state}</p>
                      <p className="text-xs font-mono text-[var(--ink-2)]">Final stack: [{cur.config.stack.join(',') || 'empty'}]</p>
                      <p className="text-xs font-mono text-[var(--ink-2)]">Steps executed: {Math.max(steps.length - 1, 0)}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="card flex flex-col items-center justify-center h-56 text-center text-[var(--ink-3)]">
                  <Cpu size={40} className="mb-3 opacity-20" />
                  <p className="text-sm">Choose a PDA example and run to visualize stack computation.</p>
                  <p className="text-xs mt-1 font-mono opacity-60">loop detection active | step limit {PDA_DEFAULT_MAX_STEPS}</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--border)] px-4 py-2.5" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => void handleRun()} disabled={isSimulating} className="btn-pda btn-sm px-4">
                {isFastMode ? 'Fast Run' : 'Run'}
              </button>
              <button onClick={() => void handleStep()} disabled={isFastMode || isSimulating} className="btn-outline btn-sm">Step</button>
              <button onClick={handlePause} disabled={!isRunning && !isSimulating} className="btn-outline btn-sm">Pause</button>
              <button onClick={resetTimeline} disabled={!simulated && !isSimulating} className="btn-outline btn-sm"><RotateCcw size={12} /> Reset</button>

              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => setCurStep(0)} disabled={steps.length === 0 || curStep <= 0} className="btn-outline btn-sm"><SkipBack size={12} /></button>
                <button onClick={() => setCurStep((p) => Math.max(0, p - 1))} disabled={steps.length === 0 || curStep <= 0} className="btn-outline btn-sm"><ChevronLeft size={12} /></button>
                <button onClick={() => setCurStep((p) => Math.min(steps.length - 1, p + 1))} disabled={steps.length === 0 || curStep >= steps.length - 1} className="btn-outline btn-sm"><ChevronRight size={12} /></button>
                <button onClick={() => setCurStep(Math.max(steps.length - 1, 0))} disabled={steps.length === 0 || curStep >= steps.length - 1} className="btn-outline btn-sm"><SkipForward size={12} /></button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-[var(--ink-3)] shrink-0 w-20">{steps.length > 0 ? `${curStep + 1} / ${steps.length}` : '- / -'}</span>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-2)] overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ background: 'var(--pda)' }} animate={{ width: `${progress}%` }} transition={{ duration: 0.15 }} />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {SPEEDS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => {
                      setSpeed(s.value);
                      stopAuto();
                    }}
                    className={`px-2 py-1 text-xs font-mono rounded-md border transition-all duration-100 ${
                      speed === s.value ? 'bg-[var(--ink)] text-white border-[var(--ink)]' : 'border-[var(--border)] text-[var(--ink-3)] hover:border-[var(--ink-3)]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {simulated && steps.length > 0 && (
          <div className="w-80 border-l border-[var(--border)] flex flex-col shrink-0 overflow-hidden" style={{ background: 'var(--surface)' }}>
            <div className="p-3 border-b border-[var(--border)]">
              <p className="section-label">Execution Trace</p>
            </div>
            <div className="flex-1 overflow-y-auto" ref={traceRef}>
              <table className="w-full text-xs">
                <thead className="sticky top-0" style={{ background: 'var(--bg-2)' }}>
                  <tr className="border-b border-[var(--border)]">
                    {['Step', 'State', 'Input Remaining', 'Stack', 'Action'].map((h) => (
                      <th key={h} className="text-left py-1.5 px-2 font-mono text-[10px] text-[var(--ink-3)]">{h}</th>
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
                      style={curStep === i ? { background: 'var(--pda-bg)' } : {}}
                    >
                      <td className="py-1.5 px-2 font-mono text-[var(--ink-3)]">{s.stepNum}</td>
                      <td className="py-1.5 px-2 font-mono font-bold text-[var(--pda)]">{s.config.state}</td>
                      <td className="py-1.5 px-2 font-mono text-[var(--ink-2)]">{s.config.remainingInput || 'eps'}</td>
                      <td className="py-1.5 px-2 font-mono text-[var(--ink-3)]">[{s.config.stack.join(',') || 'empty'}]</td>
                      <td className="py-1.5 px-2 font-mono text-[10px] text-[var(--ink-3)] max-w-36 truncate">{s.explanation}</td>
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
