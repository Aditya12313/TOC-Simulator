// TMAdvanced.ts — Multi-Tape TM, NDTM, Complexity Analysis
import type { TMDefinition, TMTransition } from './TMEngine';
import { simulateTM } from './TMEngine';

// ── Multi-Tape TM ──────────────────────────────────────
export interface MultiTapeTMTransition {
  fromState: string;
  reads: string[]; // one per tape
  toState: string;
  writes: string[]; // one per tape
  moves: ('L' | 'R' | 'S')[]; // one per tape
}

export interface MultiTapeStep {
  stepNum: number;
  state: string;
  tapeSnapshots: string[];
  headPositions: number[];
  tapeMinValues: number[];
  appliedTransition: MultiTapeTMTransition | null;
  explanation: string;
  halted: boolean;
  accepted: boolean;
  rejected: boolean;
}

function tapeSnap(tape: Map<number, string>, blankSymbol: string): { snap: string; min: number } {
  const keys = [...tape.keys()];
  if (keys.length === 0) return { snap: blankSymbol, min: 0 };
  const mn = Math.min(...keys);
  const mx = Math.max(...keys);
  let s = '';
  for (let i = mn; i <= mx; i++) s += tape.get(i) ?? blankSymbol;
  return { snap: s, min: mn };
}

export function simulateMultiTapeTM(
  transitions: MultiTapeTMTransition[],
  startState: string,
  acceptState: string,
  rejectState: string,
  blankSymbol: string,
  inputs: string[], // one per tape
  maxSteps = 500
): { steps: MultiTapeStep[]; accepted: boolean; message: string; loopDetected: boolean } {
  const numTapes = inputs.length;
  const tapes: Map<number, string>[] = inputs.map(inp => {
    const t = new Map<number, string>();
    inp.split('').forEach((c, i) => t.set(i, c));
    return t;
  });
  const heads = new Array<number>(numTapes).fill(0);
  let state = startState;
  const steps: MultiTapeStep[] = [];
  const seenConfigs = new Set<string>();

  function makeStep(t: MultiTapeTMTransition | null, expl: string, h: boolean, acc: boolean, rej: boolean): MultiTapeStep {
    const snaps = tapes.map(tape => tapeSnap(tape, blankSymbol));
    return {
      stepNum: steps.length, state,
      tapeSnapshots: snaps.map(s => s.snap),
      headPositions: snaps.map((s, i) => heads[i] - s.min),
      tapeMinValues: snaps.map(s => s.min),
      appliedTransition: t, explanation: expl,
      halted: h, accepted: acc, rejected: rej,
    };
  }

  steps.push(makeStep(null, `Initial. State: ${state}`, false, false, false));

  for (let i = 0; i < maxSteps; i++) {
    const ck = `${state}|${heads.join(',')}|${tapes.map(t => JSON.stringify([...t.entries()].sort())).join('|')}`;
    if (seenConfigs.has(ck)) return { steps, accepted: false, message: '⚠ Infinite loop detected!', loopDetected: true };
    seenConfigs.add(ck);

    if (state === acceptState) { const ls = steps[steps.length - 1]; ls.halted = ls.accepted = true; return { steps, accepted: true, message: '✓ Accepted!', loopDetected: false }; }
    if (state === rejectState) { const ls = steps[steps.length - 1]; ls.halted = ls.rejected = true; return { steps, accepted: false, message: '✗ Rejected.', loopDetected: false }; }

    const reads = tapes.map((tape, ti) => tape.get(heads[ti]) ?? blankSymbol);
    const t = transitions.find(tr => tr.fromState === state && tr.reads.every((r, ri) => r === reads[ri]));
    if (!t) {
      const ls = steps[steps.length - 1]; ls.halted = ls.rejected = true;
      return { steps, accepted: false, message: `✗ No transition from "${state}" reading [${reads.join(', ')}].`, loopDetected: false };
    }

    const prev = state;
    state = t.toState;
    tapes.forEach((tape, ti) => {
      tape.set(heads[ti], t.writes[ti]);
      if (t.moves[ti] === 'L') heads[ti]--;
      else if (t.moves[ti] === 'R') heads[ti]++;
    });
    steps.push(makeStep(t, `δ(${prev},[${reads.join(',')}])=(${t.toState},[${t.writes.join(',')}],[${t.moves.join(',')}])`, false, state === acceptState, state === rejectState));
  }
  return { steps, accepted: false, message: `⚠ Stopped after ${maxSteps} steps.`, loopDetected: true };
}

// ── Nondeterministic TM ─────────────────────────────────
export interface NDTMPathNode {
  id: string;
  state: string;
  tapeSnapshot: string;
  headPosition: number;
  tapeMin: number;
  stepNum: number;
  transition: TMTransition | null;
  explanation: string;
  children: NDTMPathNode[];
  isAccepting: boolean;
  isRejecting: boolean;
  isLoop: boolean;
}

export function simulateNDTM(
  tm: TMDefinition,
  input: string,
  maxNodes = 300
): { root: NDTMPathNode; accepted: boolean; totalNodes: number } {
  let nodeCount = 0;
  const initTape = new Map<number, string>();
  input.split('').forEach((c, i) => initTape.set(i, c));

  function snap(tape: Map<number, string>): { s: string; min: number } {
    const keys = [...tape.keys()];
    if (keys.length === 0) return { s: tm.blankSymbol, min: 0 };
    const mn = Math.min(...keys);
    const mx = Math.max(...keys);
    let r = '';
    for (let i = mn; i <= mx; i++) r += tape.get(i) ?? tm.blankSymbol;
    return { s: r, min: mn };
  }

  const s0 = snap(initTape);
  const root: NDTMPathNode = {
    id: '0', state: tm.startState, tapeSnapshot: s0.s, headPosition: 0 - s0.min, tapeMin: s0.min,
    stepNum: 0, transition: null, explanation: `Start: ${tm.startState}, "${input || tm.blankSymbol}"`,
    children: [], isAccepting: tm.startState === tm.acceptState, isRejecting: tm.startState === tm.rejectState, isLoop: false,
  };
  nodeCount++;

  function grow(node: NDTMPathNode, tape: Map<number, string>, head: number, state: string, visited: Set<string>, depth: number): void {
    if (nodeCount >= maxNodes || depth > 40 || node.isAccepting || node.isRejecting || node.isLoop) return;
    const readSym = tape.get(head) ?? tm.blankSymbol;
    const applicable = tm.transitions.filter(t => t.fromState === state && t.readSymbol === readSym);
    if (applicable.length === 0) { node.isRejecting = true; return; }
    for (const t of applicable) {
      if (nodeCount >= maxNodes) break;
      const nt = new Map(tape);
      nt.set(head, t.writeSymbol);
      const nh = head + (t.moveDirection === 'R' ? 1 : t.moveDirection === 'L' ? -1 : 0);
      const ck = `${t.toState}|${nh}|${JSON.stringify([...nt.entries()].sort())}`;
      const isLoop = visited.has(ck);
      const { s, min } = snap(nt);
      const child: NDTMPathNode = {
        id: `${node.id}-${node.children.length}`, state: t.toState, tapeSnapshot: s,
        headPosition: nh - min, tapeMin: min, stepNum: node.stepNum + 1, transition: t,
        explanation: `δ(${state},${readSym})=(${t.toState},${t.writeSymbol},${t.moveDirection})`,
        children: [], isAccepting: t.toState === tm.acceptState, isRejecting: t.toState === tm.rejectState, isLoop,
      };
      node.children.push(child); nodeCount++;
      if (!isLoop) { const nv = new Set(visited); nv.add(ck); grow(child, nt, nh, t.toState, nv, depth + 1); }
    }
  }

  const k0 = `${tm.startState}|0|${JSON.stringify([...initTape.entries()].sort())}`;
  grow(root, initTape, 0, tm.startState, new Set([k0]), 0);
  function hasAccept(n: NDTMPathNode): boolean { return n.isAccepting || n.children.some(hasAccept); }
  return { root, accepted: hasAccept(root), totalNodes: nodeCount };
}

// ── Complexity Analysis ─────────────────────────────────
export interface ComplexityDataPoint {
  inputLength: number;
  steps: number;
  input: string;
  accepted: boolean;
}

export function analyzeComplexity(tm: TMDefinition, testInputs: string[]): ComplexityDataPoint[] {
  return testInputs.map(input => {
    const trace = simulateTM(tm, input, 2000);
    return { inputLength: input.length, steps: trace.steps.length - 1, input, accepted: trace.accepted };
  });
}

export function generateComplexityInputs(pattern: 'a' | 'ab' | 'anbn' | 'binary', maxLength = 10): string[] {
  const inputs: string[] = [];
  for (let n = 1; n <= maxLength; n++) {
    if (pattern === 'a') inputs.push('a'.repeat(n));
    else if (pattern === 'ab') inputs.push('a'.repeat(Math.ceil(n / 2)) + 'b'.repeat(Math.floor(n / 2)));
    else if (pattern === 'anbn') inputs.push('a'.repeat(n) + 'b'.repeat(n));
    else if (pattern === 'binary') inputs.push(n.toString(2));
  }
  return inputs;
}
