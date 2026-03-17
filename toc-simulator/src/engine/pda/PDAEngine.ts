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
}

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
      const match = line.match(/[δd]\((\w+),\s*([^\s,)]+),\s*([^\s,)]+)\)\s*=\s*\((\w+),\s*([^)]*)\)/);
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
  maxSteps = 200
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

  while (queue.length > 0 && allPaths.length < 20) {
    const { config, steps, visited } = queue.shift()!;

    if (steps.length > maxSteps) continue;

    if (isAccepting(config, pda, mode)) {
      if (!acceptedPath) acceptedPath = steps;
      allPaths.push(steps);
      continue;
    }

    const applicable = getApplicableTransitions(config, pda);
    if (applicable.length === 0) {
      allPaths.push(steps);
      continue;
    }

    for (const t of applicable) {
      const newConfig = applyTransition(config, t);
      const key = JSON.stringify(newConfig);
      if (visited.has(key)) continue;
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
      message: `✓ Accepted by ${mode === 'final-state' ? 'final state' : 'empty stack'}.`,
      allPaths,
    };
  }

  return {
    steps: allPaths[0] || [{
      stepNum: 0, config: initialConfig, appliedTransition: null,
      explanation: 'No transitions applicable from initial configuration.',
      isAccepting: false,
    }],
    accepted: false,
    acceptanceMode: mode,
    message: `✗ Rejected. No accepting computation path found.`,
    allPaths,
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
