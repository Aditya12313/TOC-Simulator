// PDA Engine: Pushdown Automata Simulation with nondeterminism support

export interface PDATransition {
  fromState: string;
  inputSymbol: string; // '' for epsilon
  stackTop: string;    // '' for any (epsilon)
  toState: string;
  pushSymbols: string[]; // what to push (empty array = pop only)
}

export interface PDADefinition {
  states: string[];
  inputAlphabet: string[];
  stackAlphabet: string[];
  transitions: PDATransition[];
  startState: string;
  initialStackSymbol: string;
  acceptStates: string[];
}

export interface PDAConfiguration {
  state: string;
  remainingInput: string;
  stack: string[]; // top is index 0
}

export interface PDAStep {
  stepNum: number;
  config: PDAConfiguration;
  appliedTransition: PDATransition | null;
  explanation: string;
  isAccepting: boolean;
}

export interface PDATrace {
  steps: PDAStep[];
  accepted: boolean;
  acceptanceMode: 'final-state' | 'empty-stack';
  message: string;
  allPaths?: PDAStep[][];
  stopReason: PDAStopReason;
  loopDetected: boolean;
}

export type PDAStopReason =
  | 'accepted-final'
  | 'accepted-empty'
  | 'rejected-no-transition'
  | 'rejected'
  | 'loop'
  | 'stepLimit'
  | 'stopped';

export const PDA_DEFAULT_MAX_STEPS = 800;

export interface PDAExample {
  name: string;
  description: string;
  category: 'Basic Machines' | 'Language Recognizers' | 'Stack-based Patterns';
  definition: string;
  input: string;
  educationalNotes: string;
}

export const PDA_EXAMPLES: PDAExample[] = [
  {
    name: 'a^n b^n recognizer',
    description: 'Recognizes strings where #a equals #b in ordered form.',
    category: 'Language Recognizers',
    input: 'aaabbb',
    educationalNotes: 'Push one marker for each a, then pop one marker for each b. Accept when input ends and only the bottom marker remains.',
    definition: `# PDA for a^n b^n
states: q0,q1,q_accept
input: a,b
stack: A,Z
start: q0
initial_stack: Z
accept: q_accept
δ(q0,a,Z) = (q0,AZ)
δ(q0,a,A) = (q0,AA)
δ(q0,b,A) = (q1,ε)
δ(q1,b,A) = (q1,ε)
δ(q1,ε,Z) = (q_accept,Z)
δ(q0,ε,Z) = (q_accept,Z)`,
  },
  {
    name: 'Balanced parentheses',
    description: 'Checks if parentheses are properly balanced.',
    category: 'Basic Machines',
    input: '(()())',
    educationalNotes: 'Push a marker for each opening parenthesis and pop for each closing one. Accept when the stack returns to the bottom marker.',
    definition: `# PDA for balanced parentheses
states: q0,q_accept
input: (,)
stack: P,Z
start: q0
initial_stack: Z
accept: q_accept
δ(q0,(,Z) = (q0,PZ)
δ(q0,(,P) = (q0,PP)
δ(q0,),P) = (q0,ε)
δ(q0,ε,Z) = (q_accept,Z)`,
  },
  {
    name: 'Palindrome checker',
    description: 'Checks palindromes over {a,b} with center marker c.',
    category: 'Language Recognizers',
    input: 'abcba',
    educationalNotes: 'Push symbols until c, then match and pop mirrored symbols while reading the rest of the input.',
    definition: `# PDA palindrome checker with center marker c
states: q_push,q_pop,q_accept
input: a,b,c
stack: A,B,Z
start: q_push
initial_stack: Z
accept: q_accept
δ(q_push,a,Z) = (q_push,AZ)
δ(q_push,b,Z) = (q_push,BZ)
δ(q_push,a,A) = (q_push,AA)
δ(q_push,a,B) = (q_push,AB)
δ(q_push,b,A) = (q_push,BA)
δ(q_push,b,B) = (q_push,BB)
δ(q_push,c,Z) = (q_pop,Z)
δ(q_push,c,A) = (q_pop,A)
δ(q_push,c,B) = (q_pop,B)
δ(q_pop,a,A) = (q_pop,ε)
δ(q_pop,b,B) = (q_pop,ε)
δ(q_pop,ε,Z) = (q_accept,Z)`,
  },
  {
    name: 'Equal number of a\'s and b\'s',
    description: 'Accepts strings with equal counts of a and b in any order.',
    category: 'Basic Machines',
    input: 'abbaba',
    educationalNotes: 'Use stack cancellation: unmatched a markers cancel with b and vice versa. Accept when only bottom marker remains.',
    definition: `# PDA for equal number of a and b
states: q0,q_accept
input: a,b
stack: A,B,Z
start: q0
initial_stack: Z
accept: q_accept
δ(q0,a,Z) = (q0,AZ)
δ(q0,a,A) = (q0,AA)
δ(q0,a,B) = (q0,ε)
δ(q0,b,Z) = (q0,BZ)
δ(q0,b,B) = (q0,BB)
δ(q0,b,A) = (q0,ε)
δ(q0,ε,Z) = (q_accept,Z)`,
  },
  {
    name: 'a^n b^m c^m',
    description: 'Ignores a^n, then matches b^m and c^m using stack.',
    category: 'Stack-based Patterns',
    input: 'aabbbccc',
    educationalNotes: 'Read and ignore initial a\'s. Push one marker per b, then pop one per c. Accept when all pushed markers are consumed.',
    definition: `# PDA for a^n b^m c^m
states: q0,q1,q2,q_accept
input: a,b,c
stack: B,Z
start: q0
initial_stack: Z
accept: q_accept
δ(q0,a,Z) = (q0,Z)
δ(q0,b,Z) = (q1,BZ)
δ(q1,b,B) = (q1,BB)
δ(q1,c,B) = (q2,ε)
δ(q2,c,B) = (q2,ε)
δ(q2,ε,Z) = (q_accept,Z)`,
  },
];

export function parsePDADefinition(input: string): { pda: PDADefinition | null; errors: string[] } {
  const errors: string[] = [];
  const lines = input.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));

  let states: string[] = [];
  let inputAlphabet: string[] = [];
  let stackAlphabet: string[] = [];
  let startState = '';
  let initialStackSymbol = 'Z';
  let acceptStates: string[] = [];
  const transitions: PDATransition[] = [];

  for (const line of lines) {
    if (line.startsWith('states:')) {
      states = line.replace('states:', '').split(',').map(s => s.trim()).filter(Boolean);
    } else if (line.startsWith('input:')) {
      inputAlphabet = line.replace('input:', '').split(',').map(s => s.trim()).filter(Boolean);
    } else if (line.startsWith('stack:')) {
      stackAlphabet = line.replace('stack:', '').split(',').map(s => s.trim()).filter(Boolean);
    } else if (line.startsWith('start:')) {
      startState = line.replace('start:', '').trim();
    } else if (line.startsWith('initial_stack:')) {
      initialStackSymbol = line.replace('initial_stack:', '').trim();
    } else if (line.startsWith('accept:')) {
      acceptStates = line.replace('accept:', '').split(',').map(s => s.trim()).filter(Boolean);
    } else if (line.startsWith('δ(') || line.startsWith('d(')) {
      // Format: δ(q,a,A) = (p,BC) or δ(q,ε,A) = (p,ε)
      const match = line.match(/[δd]\(([A-Za-z0-9_]+),\s*([^,]+?),\s*([^\)]+?)\)\s*=\s*\(([A-Za-z0-9_]+),\s*([^)]*)\)/);
      if (match) {
        const [, from, inp, top, to, push] = match;
        const inputSym = inp === 'ε' || inp === 'eps' ? '' : inp;
        const stackTopSym = top === 'ε' || top === 'eps' ? '' : top;
        const pushStr = push.trim();
        const pushSymbols = pushStr === 'ε' || pushStr === 'eps' || pushStr === '' ? []
          : pushStr.split('').filter(Boolean);
        transitions.push({ fromState: from, inputSymbol: inputSym, stackTop: stackTopSym, toState: to, pushSymbols });
      } else {
        errors.push(`Cannot parse transition: "${line}". Expected format: δ(state,input,stackTop) = (newState,push)`);
      }
    }
  }

  if (states.length === 0) errors.push('No states defined. Add a line: states: q0,q1,...');
  if (!startState) errors.push('No start state defined. Add: start: q0');
  if (!initialStackSymbol) errors.push('No initial stack symbol defined. Add: initial_stack: Z');

  const stateSet = new Set(states);
  const stackSet = new Set(stackAlphabet.concat(initialStackSymbol));

  if (startState && !stateSet.has(startState)) {
    errors.push(`Start state "${startState}" is not listed in states.`);
  }

  acceptStates.forEach((state) => {
    if (!stateSet.has(state)) {
      errors.push(`Accept state "${state}" is not listed in states.`);
    }
  });

  transitions.forEach((t, idx) => {
    if (!stateSet.has(t.fromState)) {
      errors.push(`Transition #${idx + 1}: unknown from-state "${t.fromState}".`);
    }
    if (!stateSet.has(t.toState)) {
      errors.push(`Transition #${idx + 1}: unknown to-state "${t.toState}".`);
    }
    if (t.stackTop && !stackSet.has(t.stackTop)) {
      errors.push(`Transition #${idx + 1}: stack symbol "${t.stackTop}" is not in stack alphabet.`);
    }
    for (const sym of t.pushSymbols) {
      if (!stackSet.has(sym)) {
        errors.push(`Transition #${idx + 1}: pushed symbol "${sym}" is not in stack alphabet.`);
      }
    }
    if (t.inputSymbol && inputAlphabet.length > 0 && !inputAlphabet.includes(t.inputSymbol)) {
      errors.push(`Transition #${idx + 1}: input symbol "${t.inputSymbol}" is not in input alphabet.`);
    }
  });

  if (errors.length > 0) return { pda: null, errors };

  return {
    pda: { states, inputAlphabet, stackAlphabet, transitions, startState, initialStackSymbol, acceptStates },
    errors,
  };
}

function isAccepting(config: PDAConfiguration, pda: PDADefinition, mode: 'final-state' | 'empty-stack'): boolean {
  if (config.remainingInput.length > 0) return false;
  if (mode === 'final-state') return pda.acceptStates.includes(config.state);
  if (mode === 'empty-stack') return config.stack.length === 0;
  return false;
}

function getApplicableTransitions(config: PDAConfiguration, pda: PDADefinition): PDATransition[] {
  const { state, remainingInput, stack } = config;
  const stackTop = stack.length > 0 ? stack[0] : '';
  const nextInput = remainingInput.length > 0 ? remainingInput[0] : '';

  return pda.transitions.filter(t => {
    const stateMatch = t.fromState === state;
    const inputMatch = t.inputSymbol === '' || t.inputSymbol === nextInput;
    const stackMatch = t.stackTop === '' || t.stackTop === stackTop;
    return stateMatch && inputMatch && stackMatch;
  });
}

function applyTransition(config: PDAConfiguration, t: PDATransition): PDAConfiguration {
  const newStack = [...config.stack];
  // Pop if stackTop matches
  if (t.stackTop !== '' && newStack[0] === t.stackTop) newStack.shift();
  else if (t.stackTop === '' && newStack.length > 0) {} // no pop for epsilon stack
  // Push symbols (reversed so first element ends up on top)
  for (let i = t.pushSymbols.length - 1; i >= 0; i--) {
    newStack.unshift(t.pushSymbols[i]);
  }
  const newInput = t.inputSymbol !== '' ? config.remainingInput.slice(1) : config.remainingInput;
  return { state: t.toState, remainingInput: newInput, stack: newStack };
}

export function simulatePDA(
  pda: PDADefinition,
  input: string,
  mode: 'final-state' | 'empty-stack' = 'final-state',
  maxSteps = PDA_DEFAULT_MAX_STEPS
): PDATrace {
  const initialConfig: PDAConfiguration = {
    state: pda.startState,
    remainingInput: input,
    stack: [pda.initialStackSymbol],
  };

  // BFS over all nondeterministic paths
  type Path = { config: PDAConfiguration; steps: PDAStep[]; visited: Set<string> };
  const queue: Path[] = [{
    config: initialConfig,
    steps: [{
      stepNum: 0,
      config: initialConfig,
      appliedTransition: null,
      explanation: `Initial configuration. State: ${initialConfig.state}, Input: "${input}", Stack: [${initialConfig.stack.join(',')}]`,
      isAccepting: isAccepting(initialConfig, pda, mode),
    }],
    visited: new Set([JSON.stringify(initialConfig)]),
  }];

  let acceptedPath: PDAStep[] | null = null;
  let allPaths: PDAStep[][] = [];
  let sawLoop = false;
  let sawStepLimit = false;
  let sawDeadEnd = false;

  while (queue.length > 0 && allPaths.length < 20) {
    const { config, steps, visited } = queue.shift()!;

    if (steps.length > maxSteps) {
      sawStepLimit = true;
      continue;
    }

    if (isAccepting(config, pda, mode)) {
      if (!acceptedPath) acceptedPath = steps;
      allPaths.push(steps);
      continue;
    }

    const applicable = getApplicableTransitions(config, pda);
    if (applicable.length === 0) {
      sawDeadEnd = true;
      allPaths.push(steps);
      continue;
    }

    for (const t of applicable) {
      const newConfig = applyTransition(config, t);
      const key = JSON.stringify(newConfig);
      if (visited.has(key)) {
        sawLoop = true;
        continue;
      }
      const newVisited = new Set(visited);
      newVisited.add(key);
      const step: PDAStep = {
        stepNum: steps.length,
        config: newConfig,
        appliedTransition: t,
        explanation: buildExplanation(t, config, newConfig),
        isAccepting: isAccepting(newConfig, pda, mode),
      };
      queue.push({ config: newConfig, steps: [...steps, step], visited: newVisited });
    }
  }

  if (acceptedPath) {
    return {
      steps: acceptedPath,
      accepted: true,
      acceptanceMode: mode,
      message: mode === 'final-state' ? '✓ Accepted by final state.' : '✓ Accepted by empty stack.',
      allPaths,
      stopReason: mode === 'final-state' ? 'accepted-final' : 'accepted-empty',
      loopDetected: false,
    };
  }

  const fallbackSteps = allPaths[0] || [{
    stepNum: 0,
    config: initialConfig,
    appliedTransition: null,
    explanation: 'No transitions applicable from initial configuration.',
    isAccepting: false,
  }];

  if (sawStepLimit && !sawDeadEnd) {
    return {
      steps: fallbackSteps,
      accepted: false,
      acceptanceMode: mode,
      message: `⚠ Step limit reached (${maxSteps}). Execution stopped safely.`,
      allPaths,
      stopReason: 'stepLimit',
      loopDetected: false,
    };
  }

  if (sawLoop && !sawDeadEnd) {
    return {
      steps: fallbackSteps,
      accepted: false,
      acceptanceMode: mode,
      message: '⚠ Loop detected: repeated PDA configuration.',
      allPaths,
      stopReason: 'loop',
      loopDetected: true,
    };
  }

  if (sawDeadEnd) {
    return {
      steps: fallbackSteps,
      accepted: false,
      acceptanceMode: mode,
      message: '✗ No valid transition → rejected.',
      allPaths,
      stopReason: 'rejected-no-transition',
      loopDetected: sawLoop,
    };
  }

  return {
    steps: fallbackSteps,
    accepted: false,
    acceptanceMode: mode,
    message: '✗ Rejected. No accepting computation path found.',
    allPaths,
    stopReason: 'rejected',
    loopDetected: sawLoop,
  };
}

export async function simulatePDAAsync(
  pda: PDADefinition,
  input: string,
  mode: 'final-state' | 'empty-stack' = 'final-state',
  maxSteps = PDA_DEFAULT_MAX_STEPS,
  onProgress: (steps: PDAStep[]) => void,
  checkCancelled: () => boolean
): Promise<PDATrace> {
  const initialConfig: PDAConfiguration = {
    state: pda.startState,
    remainingInput: input,
    stack: [pda.initialStackSymbol],
  };

  type Path = { config: PDAConfiguration; steps: PDAStep[]; visited: Set<string> };
  const queue: Path[] = [{
    config: initialConfig,
    steps: [{
      stepNum: 0,
      config: initialConfig,
      appliedTransition: null,
      explanation: `Initial configuration. State: ${initialConfig.state}, Input: "${input}", Stack: [${initialConfig.stack.join(',')}]`,
      isAccepting: isAccepting(initialConfig, pda, mode),
    }],
    visited: new Set([JSON.stringify(initialConfig)]),
  }];

  let acceptedPath: PDAStep[] | null = null;
  const allPaths: PDAStep[][] = [];
  let sawLoop = false;
  let sawStepLimit = false;
  let sawDeadEnd = false;
  const CHUNK_SIZE = 120;

  while (queue.length > 0 && allPaths.length < 20) {
    if (checkCancelled()) {
      const cancelledSteps = acceptedPath || allPaths[0] || queue[0]?.steps || [{
        stepNum: 0,
        config: initialConfig,
        appliedTransition: null,
        explanation: 'Execution stopped by user.',
        isAccepting: false,
      }];
      return {
        steps: cancelledSteps,
        accepted: false,
        acceptanceMode: mode,
        message: '⏹ Execution stopped by user.',
        allPaths,
        stopReason: 'stopped',
        loopDetected: false,
      };
    }

    for (let c = 0; c < CHUNK_SIZE && queue.length > 0 && allPaths.length < 20; c++) {
      const { config, steps, visited } = queue.shift()!;

      if (steps.length > maxSteps) {
        sawStepLimit = true;
        continue;
      }

      if (isAccepting(config, pda, mode)) {
        if (!acceptedPath) acceptedPath = steps;
        allPaths.push(steps);
        continue;
      }

      const applicable = getApplicableTransitions(config, pda);
      if (applicable.length === 0) {
        sawDeadEnd = true;
        allPaths.push(steps);
        continue;
      }

      for (const t of applicable) {
        const newConfig = applyTransition(config, t);
        const key = JSON.stringify(newConfig);
        if (visited.has(key)) {
          sawLoop = true;
          continue;
        }

        const newVisited = new Set(visited);
        newVisited.add(key);
        const step: PDAStep = {
          stepNum: steps.length,
          config: newConfig,
          appliedTransition: t,
          explanation: buildExplanation(t, config, newConfig),
          isAccepting: isAccepting(newConfig, pda, mode),
        };
        queue.push({ config: newConfig, steps: [...steps, step], visited: newVisited });
      }
    }

    const progressSteps = acceptedPath || allPaths[0] || queue[0]?.steps;
    if (progressSteps) onProgress(progressSteps);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  if (acceptedPath) {
    return {
      steps: acceptedPath,
      accepted: true,
      acceptanceMode: mode,
      message: mode === 'final-state' ? '✓ Accepted by final state.' : '✓ Accepted by empty stack.',
      allPaths,
      stopReason: mode === 'final-state' ? 'accepted-final' : 'accepted-empty',
      loopDetected: false,
    };
  }

  const fallbackSteps = allPaths[0] || [{
    stepNum: 0,
    config: initialConfig,
    appliedTransition: null,
    explanation: 'No transitions applicable from initial configuration.',
    isAccepting: false,
  }];

  if (sawStepLimit && !sawDeadEnd) {
    return {
      steps: fallbackSteps,
      accepted: false,
      acceptanceMode: mode,
      message: `⚠ Step limit reached (${maxSteps}). Execution stopped safely.`,
      allPaths,
      stopReason: 'stepLimit',
      loopDetected: false,
    };
  }

  if (sawLoop && !sawDeadEnd) {
    return {
      steps: fallbackSteps,
      accepted: false,
      acceptanceMode: mode,
      message: '⚠ Loop detected: repeated PDA configuration.',
      allPaths,
      stopReason: 'loop',
      loopDetected: true,
    };
  }

  if (sawDeadEnd) {
    return {
      steps: fallbackSteps,
      accepted: false,
      acceptanceMode: mode,
      message: '✗ No valid transition → rejected.',
      allPaths,
      stopReason: 'rejected-no-transition',
      loopDetected: sawLoop,
    };
  }

  return {
    steps: fallbackSteps,
    accepted: false,
    acceptanceMode: mode,
    message: '✗ Rejected. No accepting computation path found.',
    allPaths,
    stopReason: 'rejected',
    loopDetected: sawLoop,
  };
}

function buildExplanation(t: PDATransition, from: PDAConfiguration, to: PDAConfiguration): string {
  const inp = t.inputSymbol || 'ε';
  const top = t.stackTop || 'ε';
  const push = t.pushSymbols.join('') || 'ε';
  const stateChange = from.state !== to.state ? ` → State changes from ${from.state} to ${to.state}.` : ` → Stay in state ${to.state}.`;
  const stackChange = t.pushSymbols.length === 0
    ? ` Pop "${top}" from stack.`
    : ` Pop "${top}", push "${push}" onto stack.`;
  return `Apply δ(${from.state}, ${inp}, ${top}) = (${to.state}, ${push}):${stateChange}${stackChange}`;
}

// ─────────────── NEW ADVANCED FEATURES ───────────────

// Path Tree node for nondeterministic visualization
export interface PDAPathNode {
  id: string;
  config: PDAConfiguration;
  stepNum: number;
  transition: PDATransition | null;
  explanation: string;
  children: PDAPathNode[];
  isAccepting: boolean;
  isDead: boolean; // no transitions can fire
  isLoop: boolean; // repeated configuration
}

// Build a path tree from BFS (track parent relationships)
export function buildPathTree(
  pda: PDADefinition,
  input: string,
  mode: 'final-state' | 'empty-stack' = 'final-state',
  maxNodes = 200
): { root: PDAPathNode; totalNodes: number } {
  const initialConfig: PDAConfiguration = {
    state: pda.startState,
    remainingInput: input,
    stack: [pda.initialStackSymbol],
  };

  const rootNode: PDAPathNode = {
    id: '0',
    config: initialConfig,
    stepNum: 0,
    transition: null,
    explanation: `Start: (${pda.startState}, "${input}", [${pda.initialStackSymbol}])`,
    children: [],
    isAccepting: isAcceptingConfig(initialConfig, pda, mode),
    isDead: false,
    isLoop: false,
  };

  let nodeCount = 1;

  function isAcceptingConfig(cfg: PDAConfiguration, p: PDADefinition, m: 'final-state' | 'empty-stack') {
    if (cfg.remainingInput.length > 0) return false;
    if (m === 'final-state') return p.acceptStates.includes(cfg.state);
    return cfg.stack.length === 0;
  }

  function grow(node: PDAPathNode, visited: Set<string>, depth: number): void {
    if (nodeCount >= maxNodes || depth > 30) return;
    if (node.isAccepting || node.isDead || node.isLoop) return;

    const applicable = getApplicableTransitions(node.config, pda);
    if (applicable.length === 0) { node.isDead = true; return; }

    for (const t of applicable) {
      if (nodeCount >= maxNodes) break;
      const newConfig = applyTransition(node.config, t);
      const key = JSON.stringify(newConfig);
      const isLoop = visited.has(key);

      const child: PDAPathNode = {
        id: `${node.id}-${node.children.length}`,
        config: newConfig,
        stepNum: node.stepNum + 1,
        transition: t,
        explanation: buildExplanation(t, node.config, newConfig),
        children: [],
        isAccepting: isAcceptingConfig(newConfig, pda, mode),
        isDead: false,
        isLoop,
      };
      node.children.push(child);
      nodeCount++;

      if (!isLoop) {
        const newVisited = new Set(visited);
        newVisited.add(key);
        grow(child, newVisited, depth + 1);
      }
    }
  }

  const initKey = JSON.stringify(initialConfig);
  grow(rootNode, new Set([initKey]), 0);

  return { root: rootNode, totalNodes: nodeCount };
}

// Get all accepting paths (linear paths from root to accept leaves)
export function getAllAcceptingPaths(
  pda: PDADefinition,
  input: string,
  mode: 'final-state' | 'empty-stack' = 'final-state',
  maxPaths = 10
): PDAStep[][] {
  const trace = simulatePDA(pda, input, mode, 500);
  return (trace.allPaths || []).filter(p => {
    const last = p[p.length - 1];
    return last.isAccepting;
  }).slice(0, maxPaths);
}

// Detect if a single linear path has a repeated configuration (infinite loop)
export function detectInfiniteLoopInPath(steps: PDAStep[]): { hasLoop: boolean; loopStartStep: number } {
  const seen = new Map<string, number>();
  for (const step of steps) {
    const key = JSON.stringify(step.config);
    if (seen.has(key)) return { hasLoop: true, loopStartStep: seen.get(key)! };
    seen.set(key, step.stepNum);
  }
  return { hasLoop: false, loopStartStep: -1 };
}

// CFG to PDA conversion (generates a PDA that simulates leftmost derivation)
export function cfgToPDA(grammar: { rules: { lhs: string; rhs: string[] }[]; startSymbol: string }): {
  pda: PDADefinition;
  steps: string[];
} {
  const steps: string[] = [
    'CFG → PDA Conversion (Acceptance by Empty Stack):',
    '1. Create states: q_start, q_loop, q_accept',
    '2. Push special bottom marker Z, then start symbol S onto stack',
    '3. For each grammar rule A → α, add transition: δ(q_loop, ε, A) = (q_loop, α)',
    '4. For each terminal a, add transition: δ(q_loop, a, a) = (q_loop, ε)',
    '5. When stack becomes empty, move to q_accept',
  ];

  const transitions: PDATransition[] = [];

  // Start transitions
  transitions.push({
    fromState: 'q_start', inputSymbol: '', stackTop: 'Z',
    toState: 'q_loop', pushSymbols: [grammar.startSymbol, 'Z'],
  });

  // For each grammar rule
  for (const rule of grammar.rules) {
    for (const prod of rule.rhs) {
      const pushSyms = prod === '' ? [] : prod.split('');
      transitions.push({
        fromState: 'q_loop', inputSymbol: '', stackTop: rule.lhs,
        toState: 'q_loop', pushSymbols: pushSyms,
      });
      steps.push(`  Rule ${rule.lhs} → ${prod || 'ε'}: δ(q_loop, ε, ${rule.lhs}) = (q_loop, ${prod || 'ε'})`);
    }
  }

  // Collect all terminals from grammar rules
  const allSymbols = new Set<string>();
  for (const rule of grammar.rules) {
    for (const prod of rule.rhs) {
      prod.split('').forEach(c => allSymbols.add(c));
    }
  }
  const terminals = [...allSymbols].filter(c => c !== '' && c === c.toLowerCase());

  for (const t of terminals) {
    transitions.push({
      fromState: 'q_loop', inputSymbol: t, stackTop: t,
      toState: 'q_loop', pushSymbols: [],
    });
    steps.push(`  Terminal ${t}: δ(q_loop, ${t}, ${t}) = (q_loop, ε)`);
  }

  const pda: PDADefinition = {
    states: ['q_start', 'q_loop', 'q_accept'],
    inputAlphabet: terminals,
    stackAlphabet: [],
    transitions,
    startState: 'q_start',
    initialStackSymbol: 'Z',
    acceptStates: ['q_accept'],
  };

  return { pda, steps };
}
