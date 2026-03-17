// Turing Machine Engine

export interface TMTransition {
  fromState: string;
  readSymbol: string;
  toState: string;
  writeSymbol: string;
  moveDirection: 'L' | 'R' | 'S'; // Left, Right, Stay
}

export interface TMDefinition {
  states: string[];
  inputAlphabet: string[];
  tapeAlphabet: string[];
  blankSymbol: string;
  transitions: TMTransition[];
  startState: string;
  acceptState: string;
  rejectState: string;
}

export interface TMConfiguration {
  state: string;
  tape: Map<number, string>;
  headPosition: number;
}

export interface TMStep {
  stepNum: number;
  state: string;
  tapeSnapshot: string;
  headPosition: number;
  appliedTransition: TMTransition | null;
  explanation: string;
  halted: boolean;
  accepted: boolean;
  rejected: boolean;
  tapeMin: number;
  tapeMax: number;
}

export interface TMTrace {
  steps: TMStep[];
  accepted: boolean;
  rejected: boolean;
  halted: boolean;
  message: string;
  loopDetected: boolean;
}

export function parseTMDefinition(input: string): { tm: TMDefinition | null; errors: string[] } {
  const errors: string[] = [];
  const lines = input.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));

  let states: string[] = [];
  let inputAlphabet: string[] = [];
  let tapeAlphabet: string[] = [];
  let blankSymbol = '_';
  const transitions: TMTransition[] = [];
  let startState = '';
  let acceptState = 'q_accept';
  let rejectState = 'q_reject';

  for (const line of lines) {
    if (line.startsWith('states:')) {
      states = line.replace('states:', '').split(',').map(s => s.trim()).filter(Boolean);
    } else if (line.startsWith('input:')) {
      inputAlphabet = line.replace('input:', '').split(',').map(s => s.trim()).filter(Boolean);
    } else if (line.startsWith('tape:')) {
      tapeAlphabet = line.replace('tape:', '').split(',').map(s => s.trim()).filter(Boolean);
    } else if (line.startsWith('blank:')) {
      blankSymbol = line.replace('blank:', '').trim();
    } else if (line.startsWith('start:')) {
      startState = line.replace('start:', '').trim();
    } else if (line.startsWith('accept:')) {
      acceptState = line.replace('accept:', '').trim();
    } else if (line.startsWith('reject:')) {
      rejectState = line.replace('reject:', '').trim();
    } else if (line.startsWith('δ(') || line.startsWith('d(')) {
      // Format: δ(state,symbol) = (newState,write,direction)
      const match = line.match(/[δd]\((\w+),\s*([^\s,)]+)\)\s*=\s*\((\w+),\s*([^\s,)]+),\s*([LRS])\)/);
      if (match) {
        const [, from, read, to, write, dir] = match;
        transitions.push({
          fromState: from,
          readSymbol: read === '_' || read === 'B' ? blankSymbol : read,
          toState: to,
          writeSymbol: write === '_' || write === 'B' ? blankSymbol : write,
          moveDirection: dir as 'L' | 'R' | 'S',
        });
      } else {
        errors.push(`Cannot parse transition: "${line}". Expected: δ(state,symbol) = (newState,write,L|R|S)`);
      }
    }
  }

  if (states.length === 0) errors.push('No states defined.');
  if (!startState) errors.push('No start state defined.');

  if (errors.length > 0) return { tm: null, errors };

  return {
    tm: { states, inputAlphabet, tapeAlphabet, blankSymbol, transitions, startState, acceptState, rejectState },
    errors,
  };
}

function tapeToString(tape: Map<number, string>, blank: string, min: number, max: number): string {
  let result = '';
  for (let i = min; i <= max; i++) {
    result += tape.get(i) ?? blank;
  }
  return result;
}

function configKey(state: string, tape: Map<number, string>, head: number): string {
  return `${state}|${head}|${JSON.stringify([...tape.entries()].sort((a, b) => a[0] - b[0]))}`;
}

export function simulateTM(
  tm: TMDefinition,
  input: string,
  maxSteps = 1000
): TMTrace {
  // Initialize tape
  const tape = new Map<number, string>();
  for (let i = 0; i < input.length; i++) tape.set(i, input[i]);

  let state = tm.startState;
  let head = 0;
  const steps: TMStep[] = [];
  const seenConfigs = new Set<string>();

  function getMin() { return Math.min(0, ...[...tape.keys()]); }
  function getMax() { return Math.max(input.length - 1, ...[...tape.keys()]); }

  function makeStep(
    stepNum: number,
    t: TMTransition | null,
    explanation: string,
    halted: boolean,
    accepted: boolean,
    rejected: boolean
  ): TMStep {
    const min = getMin();
    const max = getMax();
    return {
      stepNum,
      state,
      tapeSnapshot: tapeToString(tape, tm.blankSymbol, min, max),
      headPosition: head - min, // relative to snapshot start
      appliedTransition: t,
      explanation,
      halted,
      accepted,
      rejected,
      tapeMin: min,
      tapeMax: max,
    };
  }

  // Initial step
  steps.push(makeStep(0, null,
    `Initial configuration. State: ${state}, Head at position 0, Tape: "${input || tm.blankSymbol}"`,
    false, false, false));

  for (let i = 0; i < maxSteps; i++) {
    const key = configKey(state, tape, head);
    if (seenConfigs.has(key)) {
      return { steps, accepted: false, rejected: false, halted: true, message: '⚠ Infinite loop detected! Configuration repeated.', loopDetected: true };
    }
    seenConfigs.add(key);

    if (state === tm.acceptState) {
      const last = steps[steps.length - 1];
      last.halted = true; last.accepted = true;
      return { steps, accepted: true, rejected: false, halted: true, message: `✓ Accepted! Reached accept state "${tm.acceptState}".`, loopDetected: false };
    }
    if (state === tm.rejectState) {
      const last = steps[steps.length - 1];
      last.halted = true; last.rejected = true;
      return { steps, accepted: false, rejected: true, halted: true, message: `✗ Rejected! Reached reject state "${tm.rejectState}".`, loopDetected: false };
    }

    const readSym = tape.get(head) ?? tm.blankSymbol;
    const t = tm.transitions.find(tr => tr.fromState === state && tr.readSymbol === readSym);

    if (!t) {
      steps[steps.length - 1].halted = true;
      steps[steps.length - 1].rejected = true;
      return {
        steps, accepted: false, rejected: true, halted: true,
        message: `✗ Rejected! No transition from state "${state}" reading "${readSym}". Machine halts.`,
        loopDetected: false,
      };
    }

    // Apply transition
    tape.set(head, t.writeSymbol);
    const prevState = state;
    state = t.toState;
    if (t.moveDirection === 'L') head--;
    else if (t.moveDirection === 'R') head++;

    const explanation = `δ(${prevState}, ${readSym}) = (${t.toState}, ${t.writeSymbol}, ${t.moveDirection}): ` +
      `Write "${t.writeSymbol}", move ${t.moveDirection === 'L' ? 'Left' : t.moveDirection === 'R' ? 'Right' : 'Stay'}, ` +
      `new state "${t.toState}"`;

    steps.push(makeStep(i + 1, t, explanation, false, state === tm.acceptState, state === tm.rejectState));
  }

  return { steps, accepted: false, rejected: false, halted: true, message: `⚠ Simulation stopped after ${maxSteps} steps. Possible infinite loop.`, loopDetected: true };
}

// Built-in TM examples
export const TM_EXAMPLES: { name: string; description: string; definition: string; input: string }[] = [
  {
    name: 'aⁿbⁿ Recognizer',
    description: 'Recognizes strings of the form aⁿbⁿ (e.g., aabb, aaabbb)',
    input: 'aabb',
    definition: `# Turing Machine for a^n b^n
states: q0,q1,q2,q3,q4,q_accept,q_reject
input: a,b
tape: a,b,X,Y,_
blank: _
start: q0
accept: q_accept
reject: q_reject
δ(q0,_) = (q_accept,_,R)
δ(q0,a) = (q1,X,R)
δ(q0,Y) = (q3,Y,R)
δ(q1,a) = (q1,a,R)
δ(q1,Y) = (q1,Y,R)
δ(q1,b) = (q2,Y,L)
δ(q2,a) = (q2,a,L)
δ(q2,Y) = (q2,Y,L)
δ(q2,X) = (q0,X,R)
δ(q3,Y) = (q3,Y,R)
δ(q3,_) = (q_accept,_,R)
δ(q0,b) = (q_reject,b,R)
δ(q1,_) = (q_reject,_,R)`,
  },
  {
    name: 'Palindrome Checker',
    description: 'Checks if a string over {a,b} is a palindrome',
    input: 'abba',
    definition: `# TM Palindrome Checker
states: q0,q1,q2,q3,q4,q5,q_accept,q_reject
input: a,b
tape: a,b,X,_
blank: _
start: q0
accept: q_accept
reject: q_reject
δ(q0,_) = (q_accept,_,R)
δ(q0,X) = (q_accept,X,R)
δ(q0,a) = (q1,X,R)
δ(q0,b) = (q2,X,R)
δ(q1,a) = (q1,a,R)
δ(q1,b) = (q1,b,R)
δ(q1,X) = (q1,X,R)
δ(q1,_) = (q3,_,L)
δ(q2,a) = (q2,a,R)
δ(q2,b) = (q2,b,R)
δ(q2,X) = (q2,X,R)
δ(q2,_) = (q4,_,L)
δ(q3,a) = (q5,X,L)
δ(q3,X) = (q_accept,X,R)
δ(q3,b) = (q_reject,b,L)
δ(q4,b) = (q5,X,L)
δ(q4,X) = (q_accept,X,R)
δ(q4,a) = (q_reject,a,L)
δ(q5,a) = (q5,a,L)
δ(q5,b) = (q5,b,L)
δ(q5,X) = (q0,X,R)`,
  },
  {
    name: 'Binary Increment',
    description: 'Increments a binary number by 1',
    input: '1011',
    definition: `# Binary Increment Machine
states: q0,q1,q_accept
input: 0,1
tape: 0,1,_
blank: _
start: q0
accept: q_accept
reject: q_reject
δ(q0,0) = (q0,0,R)
δ(q0,1) = (q0,1,R)
δ(q0,_) = (q1,_,L)
δ(q1,1) = (q1,0,L)
δ(q1,0) = (q_accept,1,R)
δ(q1,_) = (q_accept,1,R)`,
  },
  {
    name: 'String Copier',
    description: 'Copies a string of 0s and 1s (format: input, then blank separator)',
    input: '101',
    definition: `# String Copier (copies binary string after a separator)
states: q0,q1,q2,q3,q4,q5,q_accept
input: 0,1
tape: 0,1,a,b,_
blank: _
start: q0
accept: q_accept
reject: q_reject
δ(q0,0) = (q1,a,R)
δ(q0,1) = (q2,b,R)
δ(q0,_) = (q_accept,_,S)
δ(q1,0) = (q1,0,R)
δ(q1,1) = (q1,1,R)
δ(q1,_) = (q3,0,L)
δ(q2,0) = (q2,0,R)
δ(q2,1) = (q2,1,R)
δ(q2,_) = (q3,1,L)
δ(q3,0) = (q3,0,L)
δ(q3,1) = (q3,1,L)
δ(q3,a) = (q0,a,R)
δ(q3,b) = (q0,b,R)`,
  },
];
