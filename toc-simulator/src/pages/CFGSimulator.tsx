import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  RotateCcw,
  BookOpen,
  Search,
  History,
  ChevronDown,
  ChevronUp,
  Binary,
  Languages,
  Calculator,
  AlertTriangle,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  TreePine,
} from 'lucide-react';
import {
  parseGrammar,
  deriveLeftmost,
  deriveRightmost,
  detectAmbiguity,
  buildParseTree,
  tokenizeProduction,
  CFG_EXAMPLES,
  CFG_DEFAULT_MAX_STEPS,
  type CFGExample,
  type DerivationStep,
  type ParseTreeNode,
  type Grammar,
} from '../engine/cfg/CFGEngine';

type CFGGroupId = 'basic' | 'structured' | 'expression' | 'ambiguous';

const CFG_GROUPS: Array<{ id: CFGGroupId; title: string; icon: typeof Binary; names: string[] }> = [
  {
    id: 'basic',
    title: 'Basic Grammars',
    icon: Binary,
    names: ['a^n b^n'],
  },
  {
    id: 'structured',
    title: 'Structured Languages',
    icon: Languages,
    names: ['Balanced parentheses', 'Palindromes'],
  },
  {
    id: 'expression',
    title: 'Expression Grammars',
    icon: Calculator,
    names: ['Arithmetic expressions'],
  },
  {
    id: 'ambiguous',
    title: 'Ambiguous Grammars',
    icon: AlertTriangle,
    names: ['Simple ambiguous grammar'],
  },
];

const DEFAULT_GROUPS: Record<CFGGroupId, boolean> = {
  basic: false,
  structured: false,
  expression: false,
  ambiguous: false,
};

const SPEEDS = [
  { label: '0.5x', value: 1 },
  { label: '1x', value: 2 },
  { label: '2x', value: 3 },
];

const CFG_GRAMMAR_MIN_HEIGHT = 100;
const CFG_GRAMMAR_MAX_HEIGHT = 460;
const CFG_GRAMMAR_DEFAULT_HEIGHT = 176;
const CFG_GRAMMAR_HEIGHT_SESSION_KEY = 'cfg-grammar-input-height';

function clampGrammarHeight(height: number): number {
  return Math.max(CFG_GRAMMAR_MIN_HEIGHT, Math.min(CFG_GRAMMAR_MAX_HEIGHT, height));
}

function treeDepth(node: ParseTreeNode | null): number {
  if (!node) return 0;
  if (node.children.length === 0) return 0;
  return 1 + Math.max(...node.children.map((child) => treeDepth(child)));
}

function leafCount(node: ParseTreeNode | null): number {
  if (!node) return 1;
  if (node.children.length === 0) return 1;
  return node.children.reduce((sum, child) => sum + leafCount(child), 0);
}

function trimTree(node: ParseTreeNode, maxDepth: number, depth = 0): ParseTreeNode {
  if (depth >= maxDepth) {
    return { ...node, children: [] };
  }

  return {
    ...node,
    children: node.children.map((child) => trimTree(child, maxDepth, depth + 1)),
  };
}

function renderHighlightedSentential(form: string, position: number, grammar: Grammar | null): ReactNode {
  const normalized = form || 'ε';
  if (!grammar || normalized === 'ε') return normalized;

  const tokens = tokenizeProduction(normalized, grammar.nonTerminals).filter((token) => token !== '');
  if (tokens.length === 0) return 'ε';

  return tokens.map((token, index) => (
    <span
      key={`${token}-${index}`}
      className={index === position ? 'px-1 rounded bg-[var(--cfg-bg)] border border-[var(--cfg-border)] text-[var(--cfg)]' : ''}
    >
      {token}
    </span>
  ));
}

function TreeNodeView({
  node,
  x,
  y,
  spread,
  depth,
  animate,
}: {
  node: ParseTreeNode;
  x: number;
  y: number;
  spread: number;
  depth: number;
  animate: boolean;
}) {
  const childCount = node.children.length;
  const childSpread = Math.max(54, spread / Math.max(childCount, 1));
  const startX = x - ((childCount - 1) * childSpread) / 2;

  const nodeFill = node.isTerminal ? 'var(--surface)' : 'var(--cfg)';
  const nodeStroke = node.isTerminal ? 'var(--cfg-border)' : 'var(--cfg)';
  const textColor = node.isTerminal ? 'var(--cfg)' : '#ffffff';

  return (
    <g>
      {node.children.map((child, index) => {
        const childX = startX + index * childSpread;
        const childY = y + 70;

        return (
          <g key={`${child.symbol}-${index}`}>
            <motion.line
              x1={x}
              y1={y + 14}
              x2={childX}
              y2={childY - 14}
              stroke="var(--border)"
              strokeWidth="1.5"
              initial={animate ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18, delay: depth * 0.06 }}
            />
            <TreeNodeView node={child} x={childX} y={childY} spread={childSpread * 0.95} depth={depth + 1} animate={animate} />
          </g>
        );
      })}

      <motion.g
        initial={animate ? { scale: 0.9, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, delay: depth * 0.06 }}
      >
        <circle cx={x} cy={y} r="14" fill={nodeFill} stroke={nodeStroke} strokeWidth="1.5" />
        <text
          x={x}
          y={y + 4}
          textAnchor="middle"
          fontSize="9"
          fontFamily="JetBrains Mono"
          fontWeight="700"
          fill={textColor}
        >
          {node.symbol}
        </text>
      </motion.g>
    </g>
  );
}

export default function CFGSimulator() {
  const [activeExample, setActiveExample] = useState<CFGExample | null>(CFG_EXAMPLES[0]);
  const [exampleSearch, setExampleSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<CFGGroupId, boolean>>(DEFAULT_GROUPS);
  const [recentExampleNames, setRecentExampleNames] = useState<string[]>([CFG_EXAMPLES[0].name]);

  const [definition, setDefinition] = useState(CFG_EXAMPLES[0].definition);
  const [startSymbol, setStartSymbol] = useState(CFG_EXAMPLES[0].startSymbol);
  const [inputStr, setInputStr] = useState(CFG_EXAMPLES[0].input);
  const [derivationType, setDerivationType] = useState<'leftmost' | 'rightmost'>('leftmost');
  const [isFastMode, setIsFastMode] = useState(false);

  const [grammar, setGrammar] = useState<Grammar | null>(null);
  const [steps, setSteps] = useState<DerivationStep[]>([]);
  const [curStep, setCurStep] = useState(0);
  const [speed, setSpeed] = useState(2);
  const [isRunning, setIsRunning] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ ok: boolean; msg: string; ambiguous: boolean } | null>(null);
  const [treeRoot, setTreeRoot] = useState<ParseTreeNode | null>(null);
  const [ambiguityDemo, setAmbiguityDemo] = useState<{
    explanation: string;
    leftTree: ParseTreeNode;
    rightTree: ParseTreeNode;
  } | null>(null);
  const [simulated, setSimulated] = useState(false);

  const [grammarInputHeight, setGrammarInputHeight] = useState<number>(() => {
    if (typeof window === 'undefined') {
      return CFG_GRAMMAR_DEFAULT_HEIGHT;
    }

    const savedHeight = Number(window.sessionStorage.getItem(CFG_GRAMMAR_HEIGHT_SESSION_KEY));
    if (!Number.isFinite(savedHeight)) {
      return CFG_GRAMMAR_DEFAULT_HEIGHT;
    }

    return clampGrammarHeight(savedHeight);
  });

  const autoRef = useRef<number | null>(null);
  const traceRef = useRef<HTMLDivElement>(null);
  const grammarInputRef = useRef<HTMLTextAreaElement | null>(null);
  const speedMs = [1100, 480, 150][speed - 1];

  const stopAuto = useCallback(() => {
    if (autoRef.current !== null) {
      clearInterval(autoRef.current);
      autoRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const startAuto = useCallback(
    (lastFrame: number) => {
      if (lastFrame <= 0) return;
      stopAuto();
      setIsRunning(true);
      autoRef.current = window.setInterval(() => {
        setCurStep((previous) => {
          if (previous >= lastFrame) {
            stopAuto();
            return previous;
          }
          return previous + 1;
        });
      }, speedMs);
    },
    [speedMs, stopAuto]
  );

  const resetTimeline = useCallback(() => {
    stopAuto();
    setIsSimulating(false);
    setSteps([]);
    setCurStep(0);
    setResult(null);
    setTreeRoot(null);
    setAmbiguityDemo(null);
    setErrors([]);
    setGrammar(null);
    setSimulated(false);
  }, [stopAuto]);

  const loadExample = useCallback(
    (example: CFGExample) => {
      setDefinition(example.definition);
      setStartSymbol(example.startSymbol);
      setInputStr(example.input);
      setActiveExample(example);
      setRecentExampleNames((previous) => [example.name, ...previous.filter((name) => name !== example.name)].slice(0, 3));
      resetTimeline();
    },
    [resetTimeline]
  );

  const toggleGroup = useCallback((groupId: CFGGroupId) => {
    setCollapsedGroups((previous) => ({ ...previous, [groupId]: !previous[groupId] }));
  }, []);

  const runSimulation = useCallback(
    async (autoStart = false) => {
      resetTimeline();
      setIsSimulating(true);

      // Yield once so status updates before the synchronous derivation search starts.
      await new Promise((resolve) => window.setTimeout(resolve, 0));

      const { grammar: parsed, errors: parseErrors } = parseGrammar(definition, startSymbol.trim());
      if (parseErrors.length > 0) {
        setErrors(parseErrors);
        setIsSimulating(false);
        return null;
      }

      setGrammar(parsed);

      const selected = derivationType === 'leftmost'
        ? deriveLeftmost(parsed, inputStr, CFG_DEFAULT_MAX_STEPS)
        : deriveRightmost(parsed, inputStr, CFG_DEFAULT_MAX_STEPS);

      const alternate = derivationType === 'leftmost'
        ? deriveRightmost(parsed, inputStr, CFG_DEFAULT_MAX_STEPS)
        : deriveLeftmost(parsed, inputStr, CFG_DEFAULT_MAX_STEPS);

      const accepted = selected.success || alternate.success;
      const chosen = selected.success ? selected : alternate.success ? alternate : selected;
      const chosenSteps = chosen.steps;

      let message = '';
      if (accepted) {
        if (selected.success) {
          message = 'Accepted. A derivation was found for the input string.';
        } else {
          const fallbackType = derivationType === 'leftmost' ? 'rightmost' : 'leftmost';
          message = `Accepted. ${fallbackType} derivation found a valid path for this string.`;
        }
      } else {
        const lastSentential = chosenSteps.length > 0
          ? chosenSteps[chosenSteps.length - 1].sentential || 'ε'
          : parsed.startSymbol;
        message = `Rejected: could not derive "${inputStr || 'ε'}" within ${CFG_DEFAULT_MAX_STEPS} steps. Last reachable sentential form: ${lastSentential || 'ε'}.`;
      }

      const nextTree = accepted && chosenSteps.length > 0 ? buildParseTree(parsed, chosenSteps) : null;

      let nextAmbiguityDemo: {
        explanation: string;
        leftTree: ParseTreeNode;
        rightTree: ParseTreeNode;
      } | null = null;

      if (accepted) {
        const ambiguity = detectAmbiguity(parsed, inputStr);
        if (ambiguity.isAmbiguous && ambiguity.derivation1.length > 0 && ambiguity.derivation2.length > 0) {
          nextAmbiguityDemo = {
            explanation: ambiguity.explanation,
            leftTree: buildParseTree(parsed, ambiguity.derivation1),
            rightTree: buildParseTree(parsed, ambiguity.derivation2),
          };
        }
      }

      setSteps(chosenSteps);
      setTreeRoot(nextTree);
      setAmbiguityDemo(nextAmbiguityDemo);
      setResult({ ok: accepted, msg: message, ambiguous: Boolean(nextAmbiguityDemo) });
      setSimulated(true);
      setCurStep(isFastMode ? chosenSteps.length : 0);
      setIsSimulating(false);

      if (autoStart && !isFastMode && chosenSteps.length > 0) {
        startAuto(chosenSteps.length);
      }

      return chosenSteps;
    },
    [definition, startSymbol, derivationType, inputStr, isFastMode, resetTimeline, startAuto]
  );

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

    if (curStep >= steps.length) {
      setCurStep(0);
    }

    startAuto(steps.length);
  }, [isSimulating, isFastMode, runSimulation, simulated, curStep, steps.length, startAuto]);

  const handleStep = useCallback(async () => {
    if (isFastMode || isSimulating) return;
    stopAuto();

    if (!simulated) {
      const derivedSteps = await runSimulation(false);
      if (derivedSteps && derivedSteps.length > 0) {
        setCurStep(1);
      }
      return;
    }

    setCurStep((previous) => Math.min(steps.length, previous + 1));
  }, [isFastMode, isSimulating, simulated, runSimulation, steps.length, stopAuto]);

  useEffect(
    () => () => {
      stopAuto();
    },
    [stopAuto]
  );

  useEffect(() => {
    if (traceRef.current) {
      const row = traceRef.current.querySelector(`[data-step="${curStep}"]`);
      row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [curStep]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(CFG_GRAMMAR_HEIGHT_SESSION_KEY, String(grammarInputHeight));
    }
  }, [grammarInputHeight]);

  useEffect(() => {
    const textarea = grammarInputRef.current;
    if (!textarea) return;

    const autoHeight = clampGrammarHeight(textarea.scrollHeight);
    setGrammarInputHeight((previous) => Math.max(previous, autoHeight));
  }, [definition]);

  const commitGrammarResize = useCallback(() => {
    if (!grammarInputRef.current) return;
    setGrammarInputHeight(clampGrammarHeight(grammarInputRef.current.offsetHeight));
  }, []);

  const handleGrammarInputChange = useCallback((value: string) => {
    setDefinition(value);

    if (!grammarInputRef.current) return;
    const autoHeight = clampGrammarHeight(grammarInputRef.current.scrollHeight);
    setGrammarInputHeight((previous) => Math.max(previous, autoHeight));
  }, []);

  const searchTerm = exampleSearch.trim().toLowerCase();
  const filteredExamples = CFG_EXAMPLES.filter(
    (example) =>
      example.name.toLowerCase().includes(searchTerm) ||
      example.description.toLowerCase().includes(searchTerm)
  );

  const groupedExamples = CFG_GROUPS.map((group) => ({
    ...group,
    examples: filteredExamples.filter((example) => group.names.includes(example.name)),
  }));

  const recentExamples = recentExampleNames
    .map((name) => CFG_EXAMPLES.find((example) => example.name === name))
    .filter((example): example is CFGExample => Boolean(example));

  const totalFrames = simulated ? steps.length + 1 : 0;
  const isAtEnd = simulated && curStep >= steps.length;

  const currentStep = curStep === 0 ? null : steps[curStep - 1] ?? null;
  const previousSentential = curStep <= 1 ? startSymbol : steps[curStep - 2]?.sentential ?? startSymbol;
  const currentSentential = curStep === 0 ? startSymbol : steps[curStep - 1]?.sentential || 'ε';

  const executionStatus = isRunning || isSimulating
    ? 'In progress'
    : !simulated
      ? 'Idle'
      : result?.ok
        ? 'Accepted'
        : 'Rejected';

  const statusPillClass = executionStatus === 'In progress'
    ? 'pill-pda'
    : executionStatus === 'Accepted'
      ? 'pill-cfg'
      : executionStatus === 'Rejected'
        ? 'pill-tm'
        : 'pill-gray';

  const progress = totalFrames > 1 ? (curStep / (totalFrames - 1)) * 100 : 0;

  const displayTree = useMemo(() => {
    if (!treeRoot) return null;
    if (isFastMode) return treeRoot;

    const maxVisibleDepth = Math.max(0, Math.min(curStep, treeDepth(treeRoot)));
    return trimTree(treeRoot, maxVisibleDepth);
  }, [treeRoot, isFastMode, curStep]);

  const displayTreeWidth = Math.max(620, leafCount(displayTree) * 82);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      <div className="border-b border-[var(--border)] px-4 py-2 flex items-center gap-3" style={{ background: 'var(--surface)' }}>
        <span className="pill pill-cfg shrink-0">CFG</span>
        <span className="text-xs text-[var(--ink-3)] font-mono">Context Free Grammar Simulator</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-[var(--border)] flex flex-col shrink-0" style={{ background: 'var(--bg-2)' }}>
          <div className="p-3 border-b border-[var(--border)]">
            <div className="section-label flex items-center gap-1 mb-2">
              <BookOpen size={10} />
              Example Explorer
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
              <input
                value={exampleSearch}
                onChange={(event) => setExampleSearch(event.target.value)}
                placeholder="Search examples"
                className="code-input-field pl-7 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="px-3 pt-2 pb-3 border-b border-[var(--border)]">
            <div className="section-label flex items-center gap-1 mb-1.5">
              <History size={10} />
              Recent
            </div>
            {recentExamples.length > 0 ? (
              <div className="space-y-1.5">
                {recentExamples.map((example) => (
                  <button
                    key={`recent-${example.name}`}
                    onClick={() => loadExample(example)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--cfg-border)] hover:bg-[var(--cfg-bg)] transition-all"
                  >
                    <p className="text-[11px] font-semibold text-[var(--ink)] truncate">{example.name}</p>
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
                      <GroupIcon size={12} className="text-[var(--cfg)] shrink-0" />
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
                        group.examples.map((example) => {
                          const selected = activeExample?.name === example.name;

                          return (
                            <motion.button
                              key={example.name}
                              onClick={() => loadExample(example)}
                              whileHover={{ y: -1 }}
                              whileTap={{ scale: 0.985 }}
                              className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all text-xs mt-1 ${
                                selected
                                  ? 'border-[var(--cfg)] bg-[var(--cfg-bg)] shadow-sm'
                                  : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--cfg-border)] hover:bg-[var(--cfg-bg)]'
                              }`}
                            >
                              <div className="font-semibold text-[var(--ink)] truncate">{example.name}</div>
                              <div className="text-[10px] text-[var(--ink-3)] font-mono truncate">{example.description}</div>
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
              <div className="section-label">Grammar Rules</div>
              <textarea
                ref={grammarInputRef}
                className="code-input resize-y min-h-[100px] max-h-[460px] overflow-y-auto"
                value={definition}
                onChange={(event) => handleGrammarInputChange(event.target.value)}
                onMouseUp={commitGrammarResize}
                onTouchEnd={commitGrammarResize}
                style={{ height: `${grammarInputHeight}px` }}
              />
            </div>

            <div>
              <div className="section-label">Start Symbol</div>
              <input
                className="code-input-field"
                value={startSymbol}
                onChange={(event) => setStartSymbol(event.target.value)}
                placeholder="S"
              />
            </div>

            <div>
              <div className="section-label">Input String</div>
              <input
                className="code-input-field"
                value={inputStr}
                onChange={(event) => setInputStr(event.target.value)}
                placeholder="aaabbb"
              />
            </div>

            <div>
              <div className="section-label">Derivation Type</div>
              <div className="flex gap-1.5">
                {(['leftmost', 'rightmost'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setDerivationType(type)}
                    className={`flex-1 py-1 text-[11px] font-semibold border rounded-lg transition-all ${
                      derivationType === type
                        ? 'bg-[var(--cfg-bg)] text-[var(--cfg)] border-[var(--cfg-border)]'
                        : 'border-[var(--border)] text-[var(--ink-3)]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
              <span className="text-xs font-semibold text-[var(--ink)]">Fast Mode</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isFastMode}
                  onChange={(event) => {
                    setIsFastMode(event.target.checked);
                    stopAuto();
                  }}
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--cfg)]" />
              </label>
            </div>

            <p className="text-[10px] text-[var(--ink-3)] font-mono">Step limit: {CFG_DEFAULT_MAX_STEPS}</p>

            {errors.length > 0 && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 font-mono space-y-0.5">
                {errors.map((error, index) => (
                  <p key={`${error}-${index}`}>{error}</p>
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
                    ? 'Fast Mode: final derivation and parse tree are shown instantly.'
                    : 'Step Mode: derive one production at a time and watch the tree grow.'}
                </p>
                {result && (
                  <div className={`mt-3 ${result.ok ? 'result-accept' : 'result-reject'}`}>
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
                  style={{ borderLeftColor: 'var(--cfg)' }}
                >
                  <p className="section-label mb-1">Selected Example</p>
                  <p className="text-sm font-bold text-[var(--ink)] mb-1">{activeExample.name}</p>
                  <p className="text-xs text-[var(--ink-3)] leading-relaxed">{activeExample.educationalNotes}</p>
                </motion.div>
              )}

              {simulated ? (
                <>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="section-label mb-0">Derivation View</p>
                      <span className="text-[10px] font-mono text-[var(--ink-3)]">
                        Frame {totalFrames > 0 ? `${curStep + 1}/${totalFrames}` : '-'}
                      </span>
                    </div>
                    <div className="rounded-lg border border-[var(--cfg-border)] bg-[var(--cfg-bg)] px-4 py-4 text-center">
                      <p className="text-[10px] font-mono text-[var(--ink-3)] mb-1">Current sentential form</p>
                      <p className="font-mono text-2xl font-black text-[var(--ink)] break-all">{currentSentential || 'ε'}</p>
                    </div>

                    {currentStep ? (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                          <p className="section-label mb-1">Applied Rule</p>
                          <p className="font-mono text-sm font-bold text-[var(--cfg)]">{currentStep.rule}</p>
                          <p className="text-xs text-[var(--ink-3)] mt-1">{currentStep.explanation}</p>
                        </div>
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                          <p className="section-label mb-1">Replaced Non-terminal</p>
                          <p className="font-mono text-sm text-[var(--ink)] break-all">
                            {renderHighlightedSentential(previousSentential, currentStep.position, grammar)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                        <p className="section-label mb-1">Start</p>
                        <p className="text-xs text-[var(--ink-3)]">Derivation begins from start symbol {startSymbol || 'S'}.</p>
                      </div>
                    )}
                  </div>

                  <div className="card p-4 overflow-x-auto">
                    <div className="flex items-center justify-between mb-3">
                      <p className="section-label mb-0">Parse Tree</p>
                      <div className="flex items-center gap-1 text-[10px] font-mono text-[var(--ink-3)]">
                        <TreePine size={11} />
                        progressive expansion
                      </div>
                    </div>

                    {displayTree ? (
                      <svg style={{ minWidth: displayTreeWidth, overflow: 'visible' }} height={340}>
                        <TreeNodeView
                          key={`${curStep}-${isFastMode ? 'fast' : 'step'}`}
                          node={displayTree}
                          x={displayTreeWidth / 2}
                          y={34}
                          spread={Math.max(120, displayTreeWidth / 2.8)}
                          depth={0}
                          animate={!isFastMode}
                        />
                      </svg>
                    ) : (
                      <div className="h-40 flex items-center justify-center text-center text-[var(--ink-3)] text-sm">
                        Run the simulator to generate a parse tree.
                      </div>
                    )}
                  </div>

                  {ambiguityDemo && isAtEnd && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="card p-4 border-l-4"
                      style={{ borderLeftColor: '#f59e0b' }}
                    >
                      <div className="flex items-center gap-2 mb-2 text-[#92400e]">
                        <AlertTriangle size={14} />
                        <p className="text-sm font-bold">Simple Ambiguity Demo</p>
                      </div>
                      <p className="text-xs text-[var(--ink-3)] mb-3">{ambiguityDemo.explanation}</p>

                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Parse Tree A', root: ambiguityDemo.leftTree },
                          { label: 'Parse Tree B', root: ambiguityDemo.rightTree },
                        ].map((tree) => {
                          const width = Math.max(320, leafCount(tree.root) * 62);

                          return (
                            <div key={tree.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 overflow-x-auto">
                              <p className="section-label mb-1">{tree.label}</p>
                              <svg style={{ minWidth: width, overflow: 'visible' }} height={230}>
                                <TreeNodeView
                                  node={tree.root}
                                  x={width / 2}
                                  y={26}
                                  spread={Math.max(100, width / 2.8)}
                                  depth={0}
                                  animate={false}
                                />
                              </svg>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </>
              ) : (
                <div className="card flex flex-col items-center justify-center h-56 text-center text-[var(--ink-3)]">
                  <GitBranch size={40} className="mb-3 opacity-20" />
                  <p className="text-sm">Choose an example, then run to visualize how the grammar generates your string.</p>
                  <p className="text-xs mt-1 font-mono opacity-60">focused on derivation, parse tree, and acceptance</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--border)] px-4 py-2.5" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => void handleRun()} disabled={isSimulating} className="btn-cfg btn-sm px-4">
                {isFastMode ? 'Fast Run' : 'Run'}
              </button>
              <button onClick={() => void handleStep()} disabled={isFastMode || isSimulating} className="btn-outline btn-sm">
                Step
              </button>
              <button onClick={stopAuto} disabled={!isRunning && !isSimulating} className="btn-outline btn-sm">
                Pause
              </button>
              <button onClick={resetTimeline} disabled={!simulated && !isSimulating} className="btn-outline btn-sm">
                <RotateCcw size={12} />
                Reset
              </button>

              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => setCurStep(0)} disabled={!simulated || curStep <= 0} className="btn-outline btn-sm">
                  <SkipBack size={12} />
                </button>
                <button
                  onClick={() => setCurStep((previous) => Math.max(0, previous - 1))}
                  disabled={!simulated || curStep <= 0}
                  className="btn-outline btn-sm"
                >
                  <ChevronLeft size={12} />
                </button>
                <button
                  onClick={() => setCurStep((previous) => Math.min(steps.length, previous + 1))}
                  disabled={!simulated || curStep >= steps.length}
                  className="btn-outline btn-sm"
                >
                  <ChevronRight size={12} />
                </button>
                <button
                  onClick={() => setCurStep(steps.length)}
                  disabled={!simulated || curStep >= steps.length}
                  className="btn-outline btn-sm"
                >
                  <SkipForward size={12} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-[var(--ink-3)] shrink-0 w-24">
                {simulated ? `${curStep + 1} / ${steps.length + 1}` : '- / -'}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-2)] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'var(--cfg)' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.15 }}
                />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {SPEEDS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSpeed(option.value);
                      stopAuto();
                    }}
                    className={`px-2 py-1 text-xs font-mono rounded-md border transition-all duration-100 ${
                      speed === option.value
                        ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                        : 'border-[var(--border)] text-[var(--ink-3)] hover:border-[var(--ink-3)]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="w-80 border-l border-[var(--border)] flex flex-col shrink-0 overflow-hidden" style={{ background: 'var(--surface)' }}>
          <div className="p-3 border-b border-[var(--border)]">
            <p className="section-label">Step Explanation</p>
          </div>

          {simulated ? (
            <>
              <div className="p-3 border-b border-[var(--border)] space-y-2">
                {currentStep ? (
                  <>
                    <div className="rounded-lg border border-[var(--cfg-border)] bg-[var(--cfg-bg)] p-2.5">
                      <p className="section-label mb-1">Applied Rule</p>
                      <p className="font-mono text-xs font-bold text-[var(--cfg)] break-all">{currentStep.rule}</p>
                      <p className="text-[11px] text-[var(--ink-3)] mt-1">{currentStep.explanation}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] p-2.5">
                      <p className="section-label mb-1">Before Expansion</p>
                      <p className="font-mono text-xs text-[var(--ink)] break-all">
                        {renderHighlightedSentential(previousSentential, currentStep.position, grammar)}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] p-2.5">
                    <p className="section-label mb-1">Start Configuration</p>
                    <p className="font-mono text-xs text-[var(--ink)] break-all">{startSymbol || 'S'}</p>
                    <p className="text-[11px] text-[var(--ink-3)] mt-1">No production applied yet.</p>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto" ref={traceRef}>
                <table className="w-full text-xs">
                  <thead className="sticky top-0" style={{ background: 'var(--bg-2)' }}>
                    <tr className="border-b border-[var(--border)]">
                      {['Step', 'Sentential Form', 'Rule'].map((header) => (
                        <th key={header} className="text-left py-1.5 px-2 font-mono text-[10px] text-[var(--ink-3)]">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      data-step={0}
                      onClick={() => setCurStep(0)}
                      className="border-b border-[var(--border)] cursor-pointer transition-colors"
                      style={curStep === 0 ? { background: 'var(--cfg-bg)' } : {}}
                    >
                      <td className="py-1.5 px-2 font-mono text-[var(--ink-3)]">0</td>
                      <td className="py-1.5 px-2 font-mono font-bold text-[var(--ink)]">{startSymbol || 'S'}</td>
                      <td className="py-1.5 px-2 font-mono text-[10px] text-[var(--ink-3)]">Start</td>
                    </tr>

                    {steps.map((step, index) => {
                      const rowStep = index + 1;
                      return (
                        <tr
                          key={`${step.rule}-${index}`}
                          data-step={rowStep}
                          onClick={() => setCurStep(rowStep)}
                          className="border-b border-[var(--border)] cursor-pointer transition-colors"
                          style={curStep === rowStep ? { background: 'var(--cfg-bg)' } : {}}
                        >
                          <td className="py-1.5 px-2 font-mono text-[var(--ink-3)]">{rowStep}</td>
                          <td className="py-1.5 px-2 font-mono text-[var(--ink)] break-all">{step.sentential || 'ε'}</td>
                          <td className="py-1.5 px-2 font-mono text-[10px] text-[var(--cfg)] max-w-36 truncate">{step.rule}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center px-5 text-[var(--ink-3)] text-sm">
              Run a grammar example to see step-by-step rule explanations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
