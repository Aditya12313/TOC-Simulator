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
  stopReason: TMStopReason;
}

export type TMStopReason = 'accepted' | 'rejected' | 'halted' | 'loop' | 'stepLimit' | 'stopped';

export const TM_DEFAULT_MAX_STEPS = 1000;

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
  if (!blankSymbol) errors.push('No blank symbol defined.');

  if (blankSymbol.length !== 1) {
    errors.push(`Blank symbol must be one character. Received "${blankSymbol}".`);
  }

  const stateSet = new Set(states);
  const tapeSet = new Set(tapeAlphabet.concat(blankSymbol));
  if (startState && !stateSet.has(startState)) {
    errors.push(`Start state "${startState}" is not listed in states.`);
  }
  if (acceptState && !stateSet.has(acceptState)) {
    errors.push(`Accept state "${acceptState}" is not listed in states.`);
  }
  if (rejectState && !stateSet.has(rejectState)) {
    errors.push(`Reject state "${rejectState}" is not listed in states.`);
  }

  if (tapeAlphabet.length === 0) {
    errors.push('No tape alphabet defined.');
  }

  const seenTransitionKeys = new Set<string>();
  transitions.forEach((t, idx) => {
    if (!stateSet.has(t.fromState)) {
      errors.push(`Transition #${idx + 1}: unknown from-state "${t.fromState}".`);
    }
    if (!stateSet.has(t.toState)) {
      errors.push(`Transition #${idx + 1}: unknown to-state "${t.toState}".`);
    }
    if (!tapeSet.has(t.readSymbol)) {
      errors.push(`Transition #${idx + 1}: read symbol "${t.readSymbol}" is not in tape alphabet.`);
    }
    if (!tapeSet.has(t.writeSymbol)) {
      errors.push(`Transition #${idx + 1}: write symbol "${t.writeSymbol}" is not in tape alphabet.`);
    }

    const key = `${t.fromState}|${t.readSymbol}`;
    if (seenTransitionKeys.has(key)) {
      errors.push(`Non-deterministic transition conflict at δ(${t.fromState}, ${t.readSymbol}).`);
    }
    seenTransitionKeys.add(key);
  });

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

function getTapeBounds(tape: Map<number, string>, inputLength: number): { min: number; max: number } {
  const keys = [...tape.keys()];
  if (keys.length === 0) {
    return { min: 0, max: Math.max(0, inputLength - 1) };
  }
  return {
    min: Math.min(0, ...keys),
    max: Math.max(inputLength - 1, ...keys),
  };
}

function writeTapeSymbol(tape: Map<number, string>, pos: number, symbol: string, blank: string): void {
  if (symbol === blank) {
    tape.delete(pos);
    return;
  }
  tape.set(pos, symbol);
}

function configKey(state: string, tape: Map<number, string>, head: number, blank: string): string {
  const normalized = [...tape.entries()]
    .filter(([, symbol]) => symbol !== blank)
    .sort((a, b) => a[0] - b[0]);
  return `${state}|${head}|${JSON.stringify(normalized)}`;
}

export function simulateTM(
  tm: TMDefinition,
  input: string,
  maxSteps = TM_DEFAULT_MAX_STEPS
): TMTrace {
  // Initialize tape
  const tape = new Map<number, string>();
  for (let i = 0; i < input.length; i++) {
    writeTapeSymbol(tape, i, input[i], tm.blankSymbol);
  }

  let state = tm.startState;
  let head = 0;
  const steps: TMStep[] = [];
  const seenConfigs = new Set<string>();

  function makeStep(
    stepNum: number,
    t: TMTransition | null,
    explanation: string,
    halted: boolean,
    accepted: boolean,
    rejected: boolean
  ): TMStep {
    const { min, max } = getTapeBounds(tape, input.length);
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
    const key = configKey(state, tape, head, tm.blankSymbol);
    if (seenConfigs.has(key)) {
      return {
        steps,
        accepted: false,
        rejected: false,
        halted: true,
        message: '⚠ Loop detected: configuration repeated.',
        loopDetected: true,
        stopReason: 'loop',
      };
    }
    seenConfigs.add(key);

    if (state === tm.acceptState) {
      const last = steps[steps.length - 1];
      last.halted = true; last.accepted = true;
      return {
        steps,
        accepted: true,
        rejected: false,
        halted: true,
        message: `✓ Accepted. Reached accept state "${tm.acceptState}".`,
        loopDetected: false,
        stopReason: 'accepted',
      };
    }
    if (state === tm.rejectState) {
      const last = steps[steps.length - 1];
      last.halted = true; last.rejected = true;
      return {
        steps,
        accepted: false,
        rejected: true,
        halted: true,
        message: `✗ Rejected. Reached reject state "${tm.rejectState}".`,
        loopDetected: false,
        stopReason: 'rejected',
      };
    }

    const readSym = tape.get(head) ?? tm.blankSymbol;
    const t = tm.transitions.find(tr => tr.fromState === state && tr.readSymbol === readSym);

    if (!t) {
      steps[steps.length - 1].halted = true;
      return {
        steps,
        accepted: false,
        rejected: false,
        halted: true,
        message: `⏹ Halted. No transition from state "${state}" reading "${readSym}".`,
        loopDetected: false,
        stopReason: 'halted',
      };
    }

    // Apply transition
    writeTapeSymbol(tape, head, t.writeSymbol, tm.blankSymbol);
    const prevState = state;
    state = t.toState;
    if (t.moveDirection === 'L') head--;
    else if (t.moveDirection === 'R') head++;

    const explanation = `δ(${prevState}, ${readSym}) = (${t.toState}, ${t.writeSymbol}, ${t.moveDirection}): ` +
      `Write "${t.writeSymbol}", move ${t.moveDirection === 'L' ? 'Left' : t.moveDirection === 'R' ? 'Right' : 'Stay'}, ` +
      `new state "${t.toState}"`;

    steps.push(makeStep(i + 1, t, explanation, false, state === tm.acceptState, state === tm.rejectState));
  }

  if (state === tm.acceptState) {
    const last = steps[steps.length - 1];
    last.halted = true;
    last.accepted = true;
    return {
      steps,
      accepted: true,
      rejected: false,
      halted: true,
      message: `✓ Accepted. Reached accept state "${tm.acceptState}".`,
      loopDetected: false,
      stopReason: 'accepted',
    };
  }

  if (state === tm.rejectState) {
    const last = steps[steps.length - 1];
    last.halted = true;
    last.rejected = true;
    return {
      steps,
      accepted: false,
      rejected: true,
      halted: true,
      message: `✗ Rejected. Reached reject state "${tm.rejectState}".`,
      loopDetected: false,
      stopReason: 'rejected',
    };
  }

  return {
    steps,
    accepted: false,
    rejected: false,
    halted: true,
    message: `⚠ Step limit reached (${maxSteps}). Execution stopped safely.`,
    loopDetected: false,
    stopReason: 'stepLimit',
  };
}

export interface TMExample {
  name: string;
  description: string;
  definition: string;
  input: string;
  educationalNotes?: string;
  optimizedRun?: (input: string) => { accepted: boolean; message: string; tapeSnapshot?: string };
}

// Built-in TM examples
export const TM_EXAMPLES: TMExample[] = [
  {
    name: 'a^n b^n recognizer',
    description: 'Recognizes strings of the form aⁿbⁿ (e.g., aabb, aaabbb)',
    input: 'aabb',
    educationalNotes: 'This machine bounces back and forth, crossing out one "a" (with X) and then the corresponding "b" (with Y). It accepts if all a\'s and b\'s are perfectly matched.',
    optimizedRun: (input) => {
      const isMatch = /^a*b*$/.test(input) && (input.match(/a/g)?.length || 0) === (input.match(/b/g)?.length || 0);
      return {
        accepted: isMatch,
        message: isMatch ? '✓ Accepted. Valid a^n b^n string.' : '✗ Rejected. String does not match a^n b^n.',
      };
    },
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
    name: 'String reversal',
    description: 'Reverses a binary string, appending the result after a # (e.g. 1011 -> 1011#1101)',
    input: '1011',
    educationalNotes: 'Moves to the end to write a # separator. Then repeatedly marks the rightmost unmarked digit, copies it to the far right, and moves left to find the next unmarked digit.',
    optimizedRun: (input) => {
      const isBin = /^[01]+$/.test(input);
      if (!isBin && input !== '') return { accepted: false, message: '✗ Rejected. Invalid input (only 0/1 allowed).' };
      const rev = input.split('').reverse().join('');
      return { accepted: true, message: '✓ Accepted. Reversed string.', tapeSnapshot: `${input}#${rev}` };
    },
    definition: `# TM String Reversal
states: q0,q1,q_write_0,q_write_1,q_return,q_cleanup,q_accept,q_reject
input: 0,1
tape: 0,1,X,Y,#,_
blank: _
start: q0
accept: q_accept
reject: q_reject
δ(q0,0) = (q0,0,R)
δ(q0,1) = (q0,1,R)
δ(q0,_) = (q1,#,L)
δ(q1,0) = (q_write_0,X,R)
δ(q1,1) = (q_write_1,Y,R)
δ(q1,X) = (q1,X,L)
δ(q1,Y) = (q1,Y,L)
δ(q1,_) = (q_cleanup,_,R)
δ(q_write_0,X) = (q_write_0,X,R)
δ(q_write_0,Y) = (q_write_0,Y,R)
δ(q_write_0,#) = (q_write_0,#,R)
δ(q_write_0,0) = (q_write_0,0,R)
δ(q_write_0,1) = (q_write_0,1,R)
δ(q_write_0,_) = (q_return,0,L)
δ(q_write_1,X) = (q_write_1,X,R)
δ(q_write_1,Y) = (q_write_1,Y,R)
δ(q_write_1,#) = (q_write_1,#,R)
δ(q_write_1,0) = (q_write_1,0,R)
δ(q_write_1,1) = (q_write_1,1,R)
δ(q_write_1,_) = (q_return,1,L)
δ(q_return,0) = (q_return,0,L)
δ(q_return,1) = (q_return,1,L)
δ(q_return,#) = (q1,#,L)
δ(q_cleanup,X) = (q_cleanup,0,R)
δ(q_cleanup,Y) = (q_cleanup,1,R)
δ(q_cleanup,#) = (q_accept,#,R)`
  },
  {
    name: 'Palindrome checker',
    description: 'Checks if a string over {a,b} is a palindrome',
    input: 'abba',
    educationalNotes: 'The machine marks the first character, moves to the far end to verify it matches, marks it, and then moves back to the new "start" to repeat the process.',
    optimizedRun: (input) => {
      const isPal = input === input.split('').reverse().join('');
      return {
        accepted: isPal,
        message: isPal ? '✓ Accepted. String is a palindrome.' : '✗ Rejected. String is not a palindrome.',
      };
    },
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
    name: 'Binary increment',
    description: 'Increments a binary number by 1',
    input: '1011',
    educationalNotes: 'This TM goes right to the end of the input, then moves left. For every 1 it sees, it changes it to 0. When it sees a 0 or empty space, it changes it to 1 and halts.',
    optimizedRun: (input) => {
      if (!/^[01]+$/.test(input)) return { accepted: false, message: '✗ Rejected. Invalid binary input.' };
      const num = BigInt('0b' + input);
      const res = (num + 1n).toString(2);
      return { accepted: true, message: `✓ Accepted. Result: ${res}`, tapeSnapshot: res };
    },
    definition: `# Binary Increment Machine
states: q0,q1,q_accept,q_reject
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
    name: 'Unary addition',
    description: 'Adds two unary numbers separated by + (e.g., 111+11 = 11111)',
    input: '111+11',
    educationalNotes: 'Moves to the plus sign, changes it to a 1, then goes to the end of the tape and erases the extra 1.',
    optimizedRun: (input) => {
      const parts = input.split('+');
      if (parts.length !== 2 || !/^1*$/.test(parts[0]) || !/^1*$/.test(parts[1])) {
        return { accepted: false, message: '✗ Rejected. Invalid unary format (use 11+1).' };
      }
      return { accepted: true, message: '✓ Accepted. Finished addition.', tapeSnapshot: '1'.repeat(parts[0].length + parts[1].length) };
    },
    definition: `# Unary Addition Machine
states: q0,q1,q2,q_accept,q_reject
input: 1,+
tape: 1,+,_
blank: _
start: q0
accept: q_accept
reject: q_reject
δ(q0,1) = (q0,1,R)
δ(q0,+) = (q1,1,R)
δ(q1,1) = (q1,1,R)
δ(q1,_) = (q2,_,L)
δ(q2,1) = (q_accept,_,L)`
  },
  {
    name: 'String Copier',
    description: 'Copies a string of 0s and 1s (format: input, then blank separator)',
    input: '101',
    educationalNotes: 'To copy a string, the TM marks a digit, travels past the separator to write it, then travels back to find the next unmarked digit.',
    definition: `# String Copier (copies binary string after a separator)
states: q0,q1,q2,q3,q4,q5,q_accept,q_reject
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
  {
    name: 'Unary Subtraction',
    description: 'Subtracts two unary numbers (M - N, where M > N). e.g. 111-1 = 11',
    input: '111-1',
    educationalNotes: 'Repeatedly erases a 1 from the end of the right number and a 1 from the end of the left number, until the right side is empty. Then cleans up the minus sign.',
    optimizedRun: (input) => {
      const parts = input.split('-');
      if (parts.length !== 2 || !/^1*$/.test(parts[0]) || !/^1*$/.test(parts[1])) {
        return { accepted: false, message: '✗ Rejected. Invalid unary format (use 111-1).' };
      }
      const diff = Math.max(0, parts[0].length - parts[1].length);
      return { accepted: true, message: '✓ Accepted. Finished subtraction.', tapeSnapshot: '1'.repeat(diff) };
    },
    definition: `# Unary Subtraction Machine (M > N)
states: q0,q1,q2,q3,q4,q5,q_accept,q_reject
input: 1,-
tape: 1,-,_
blank: _
start: q0
accept: q_accept
reject: q_reject
δ(q0,1) = (q0,1,R)
δ(q0,-) = (q1,-,R)
δ(q1,1) = (q1,1,R)
δ(q1,_) = (q2,_,L)
δ(q2,1) = (q3,_,L)
δ(q2,-) = (q_accept,_,L)
δ(q3,1) = (q3,1,L)
δ(q3,-) = (q4,-,L)
δ(q4,_) = (q4,_,L)
δ(q4,1) = (q5,_,R)
δ(q5,_) = (q5,_,R)
δ(q5,-) = (q1,-,R)`
  },
  {
    name: 'Even Number of 1s',
    description: 'Accepts strings with an even number of 1s (e.g. 101011)',
    input: '101011',
    educationalNotes: 'Flips between "even" and "odd" states every time a 1 is encountered. If it ends in the even state, it accepts.',
    optimizedRun: (input) => {
      const ones = input.split('').filter(c => c === '1').length;
      const accepted = ones % 2 === 0;
      return { accepted, message: accepted ? '✓ Accepted: Even number of 1s' : '✗ Rejected: Odd number of 1s' };
    },
    definition: `# Even 1s Checker
states: q_even,q_odd,q_accept,q_reject
input: 0,1
tape: 0,1,_
blank: _
start: q_even
accept: q_accept
reject: q_reject
δ(q_even,0) = (q_even,0,R)
δ(q_even,1) = (q_odd,1,R)
δ(q_even,_) = (q_accept,_,S)
δ(q_odd,0) = (q_odd,0,R)
δ(q_odd,1) = (q_even,1,R)
δ(q_odd,_) = (q_reject,_,S)`
  }
];

export async function simulateTMAsync(
  tm: TMDefinition,
  input: string,
  maxSteps: number = TM_DEFAULT_MAX_STEPS,
  onProgress: (steps: TMStep[]) => void,
  checkCancelled: () => boolean
): Promise<TMTrace> {
  const tape = new Map<number, string>();
  for (let i = 0; i < input.length; i++) {
    writeTapeSymbol(tape, i, input[i], tm.blankSymbol);
  }

  let state = tm.startState;
  let head = 0;
  const steps: TMStep[] = [];
  const seenConfigs = new Set<string>();

  const getBounds = () => getTapeBounds(tape, input.length);
  const pushInitialStep = () => {
    const { min, max } = getBounds();
    steps.push({
      stepNum: 0,
      state,
      tapeSnapshot: tapeToString(tape, tm.blankSymbol, min, max),
      headPosition: head - min,
      appliedTransition: null,
      explanation: 'Initial configuration.',
      halted: false,
      accepted: false,
      rejected: false,
      tapeMin: min,
      tapeMax: max,
    });
  };

  pushInitialStep();

  const CHUNK_SIZE = 200;
  let i = 0;

  while (i < maxSteps) {
    if (checkCancelled()) {
      return {
        steps,
        accepted: false,
        rejected: false,
        halted: true,
        message: '⏹ Execution stopped by user.',
        loopDetected: false,
        stopReason: 'stopped',
      };
    }

    for (let c = 0; c < CHUNK_SIZE && i < maxSteps; c++, i++) {
      if (checkCancelled()) {
        return {
          steps,
          accepted: false,
          rejected: false,
          halted: true,
          message: '⏹ Execution stopped by user.',
          loopDetected: false,
          stopReason: 'stopped',
        };
      }

      const key = configKey(state, tape, head, tm.blankSymbol);
      if (seenConfigs.has(key)) {
        return {
          steps,
          accepted: false,
          rejected: false,
          halted: true,
          message: '⚠ Loop detected: configuration repeated.',
          loopDetected: true,
          stopReason: 'loop',
        };
      }
      seenConfigs.add(key);

      if (state === tm.acceptState) {
        steps[steps.length - 1].halted = true;
        steps[steps.length - 1].accepted = true;
        return {
          steps,
          accepted: true,
          rejected: false,
          halted: true,
          message: `✓ Accepted. Reached accept state "${tm.acceptState}".`,
          loopDetected: false,
          stopReason: 'accepted',
        };
      }

      if (state === tm.rejectState) {
        steps[steps.length - 1].halted = true;
        steps[steps.length - 1].rejected = true;
        return {
          steps,
          accepted: false,
          rejected: true,
          halted: true,
          message: `✗ Rejected. Reached reject state "${tm.rejectState}".`,
          loopDetected: false,
          stopReason: 'rejected',
        };
      }

      const readSym = tape.get(head) ?? tm.blankSymbol;
      const t = tm.transitions.find(tr => tr.fromState === state && tr.readSymbol === readSym);
      if (!t) {
        steps[steps.length - 1].halted = true;
        return {
          steps,
          accepted: false,
          rejected: false,
          halted: true,
          message: `⏹ Halted. No transition from state "${state}" reading "${readSym}".`,
          loopDetected: false,
          stopReason: 'halted',
        };
      }

      writeTapeSymbol(tape, head, t.writeSymbol, tm.blankSymbol);
      const prevState = state;
      state = t.toState;
      if (t.moveDirection === 'L') head--;
      else if (t.moveDirection === 'R') head++;

      const explanation = `δ(${prevState}, ${readSym}) = (${t.toState}, ${t.writeSymbol}, ${t.moveDirection})`;
      const { min, max } = getBounds();
      steps.push({
        stepNum: i + 1,
        state,
        tapeSnapshot: tapeToString(tape, tm.blankSymbol, min, max),
        headPosition: head - min,
        appliedTransition: t,
        explanation,
        halted: false,
        accepted: state === tm.acceptState,
        rejected: state === tm.rejectState,
        tapeMin: min,
        tapeMax: max,
      });
    }

    // Yield to UI to avoid freezing
    onProgress(steps.slice());
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  if (state === tm.acceptState) {
    const last = steps[steps.length - 1];
    last.halted = true;
    last.accepted = true;
    return {
      steps,
      accepted: true,
      rejected: false,
      halted: true,
      message: `✓ Accepted. Reached accept state "${tm.acceptState}".`,
      loopDetected: false,
      stopReason: 'accepted',
    };
  }

  if (state === tm.rejectState) {
    const last = steps[steps.length - 1];
    last.halted = true;
    last.rejected = true;
    return {
      steps,
      accepted: false,
      rejected: true,
      halted: true,
      message: `✗ Rejected. Reached reject state "${tm.rejectState}".`,
      loopDetected: false,
      stopReason: 'rejected',
    };
  }

  return {
    steps,
    accepted: false,
    rejected: false,
    halted: true,
    message: `⚠ Step limit reached (${maxSteps}). Execution stopped safely.`,
    loopDetected: false,
    stopReason: 'stepLimit',
  };
}
