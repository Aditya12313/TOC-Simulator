// CFG Engine: Parsing, Derivation, Parse Trees, CYK, CNF, Ambiguity, Pumping Lemma, Random Gen, Multi-path, Equivalence

export interface CFGRule {
  lhs: string;
  rhs: string[]; // array of alternative productions, e.g. ["aSb", ""]
}

export interface Grammar {
  rules: CFGRule[];
  startSymbol: string;
  terminals: Set<string>;
  nonTerminals: Set<string>;
}

export interface DerivationStep {
  sentential: string;
  rule: string;
  position: number;
  explanation: string;
}

export interface ParseTreeNode {
  symbol: string;
  children: ParseTreeNode[];
  isTerminal: boolean;
}

export interface GrammarSimplificationStep {
  name: string;
  description: string;
  before: CFGRule[];
  after: CFGRule[];
}

// Parse raw grammar text into structured Grammar
export function parseGrammar(rulesText: string, startSymbol: string): { grammar: Grammar; errors: string[] } {
  const errors: string[] = [];
  const rules: CFGRule[] = [];
  const nonTerminals = new Set<string>();
  const terminals = new Set<string>();

  const lines = rulesText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (const line of lines) {
    const match = line.match(/^([A-Z][A-Za-z0-9']*)\s*->\s*(.+)$/);
    if (!match) {
      errors.push(`Invalid rule format: "${line}". Expected format: A -> α | β`);
      continue;
    }
    const lhs = match[1];
    const rhsStr = match[2];
    nonTerminals.add(lhs);
    const alternatives = rhsStr.split('|').map(s => s.trim());
    const rhs = alternatives.map(a => a === 'ε' || a === 'eps' || a === '' ? '' : a);
    rules.push({ lhs, rhs });
  }

  // Determine terminals: symbols in RHS that are not non-terminals
  for (const rule of rules) {
    for (const production of rule.rhs) {
      // Simple tokenization: uppercase letters are NTs, lowercase/symbols are T
      const tokens = tokenizeProduction(production, nonTerminals);
      for (const tok of tokens) {
        if (!nonTerminals.has(tok) && tok !== '') {
          terminals.add(tok);
        }
      }
    }
  }

  if (!nonTerminals.has(startSymbol) && startSymbol) {
    errors.push(`Start symbol "${startSymbol}" not found in the grammar rules.`);
  }

  return { grammar: { rules, startSymbol, terminals, nonTerminals }, errors };
}

export function tokenizeProduction(production: string, nonTerminals: Set<string>): string[] {
  // Tokenize: matches uppercase letter sequences (possible NTs) or single chars
  if (production === '') return [''];
  const tokens: string[] = [];
  let i = 0;
  while (i < production.length) {
    if (/[A-Z]/.test(production[i])) {
      // Check for multi-char non-terminal (e.g. S', A1)
      let j = i + 1;
      while (j < production.length && /[A-Za-z0-9']/.test(production[j]) && nonTerminals.has(production.slice(i, j + 1))) {
        j++;
      }
      const candidate = production.slice(i, j);
      if (nonTerminals.has(candidate)) {
        tokens.push(candidate);
        i = j;
      } else {
        tokens.push(production[i]);
        i++;
      }
    } else {
      tokens.push(production[i]);
      i++;
    }
  }
  return tokens;
}

function productionToTokens(production: string, nonTerminals: Set<string>): string[] {
  return tokenizeProduction(production, nonTerminals);
}

function getRulesMap(grammar: Grammar): Map<string, string[][]> {
  const map = new Map<string, string[][]>();
  for (const rule of grammar.rules) {
    const prods = rule.rhs.map(p => productionToTokens(p, grammar.nonTerminals));
    map.set(rule.lhs, prods);
  }
  return map;
}

// Leftmost derivation: BFS to find a derivation sequence
export function deriveLeftmost(
  grammar: Grammar,
  targetString: string,
  maxSteps = 100
): { steps: DerivationStep[]; success: boolean; message: string } {
  const rulesMap = getRulesMap(grammar);
  // BFS: state = {sentential: string[], steps: DerivationStep[]}
  const queue: { sent: string[]; steps: DerivationStep[] }[] = [];
  const visited = new Set<string>();
  const start = [grammar.startSymbol];
  queue.push({ sent: start, steps: [] });
  visited.add(start.join('|'));

  while (queue.length > 0) {
    const { sent, steps } = queue.shift()!;
    if (steps.length > maxSteps) continue;
    const sentStr = sent.join('');
    if (sentStr === targetString && !sent.some(s => grammar.nonTerminals.has(s))) {
      return { steps, success: true, message: 'Derivation found!' };
    }
    // Find leftmost non-terminal
    const lmNT = sent.findIndex(s => grammar.nonTerminals.has(s));
    if (lmNT === -1) {
      // no NT left, terminal string - check if matches
      if (sentStr === targetString) return { steps, success: true, message: '' };
      continue;
    }
    const nt = sent[lmNT];
    const prods = rulesMap.get(nt) || [];
    for (const prod of prods) {
      const newSent = [...sent.slice(0, lmNT), ...prod.filter(p => p !== ''), ...sent.slice(lmNT + 1)];
      const key = newSent.join('|');
      if (!visited.has(key)) {
        visited.add(key);
        const prodStr = prod.join('') || 'ε';
        const newStep: DerivationStep = {
          sentential: newSent.join('') || 'ε',
          rule: `${nt} → ${prod.join('') || 'ε'}`,
          position: lmNT,
          explanation: `Replace leftmost non-terminal "${nt}" with "${prodStr}"`,
        };
        queue.push({ sent: newSent, steps: [...steps, newStep] });
      }
    }
  }
  return { steps: [], success: false, message: `Cannot derive "${targetString}" from "${grammar.startSymbol}". The string is not in the language.` };
}

// Rightmost derivation
export function deriveRightmost(
  grammar: Grammar,
  targetString: string,
  maxSteps = 100
): { steps: DerivationStep[]; success: boolean; message: string } {
  const rulesMap = getRulesMap(grammar);
  const queue: { sent: string[]; steps: DerivationStep[] }[] = [];
  const visited = new Set<string>();
  const start = [grammar.startSymbol];
  queue.push({ sent: start, steps: [] });
  visited.add(start.join('|'));

  while (queue.length > 0) {
    const { sent, steps } = queue.shift()!;
    if (steps.length > maxSteps) continue;
    const sentStr = sent.join('');
    if (sentStr === targetString && !sent.some(s => grammar.nonTerminals.has(s))) {
      return { steps, success: true, message: '' };
    }
    // Find rightmost non-terminal
    let rmNT = -1;
    for (let i = sent.length - 1; i >= 0; i--) {
      if (grammar.nonTerminals.has(sent[i])) { rmNT = i; break; }
    }
    if (rmNT === -1) continue;
    const nt = sent[rmNT];
    const prods = rulesMap.get(nt) || [];
    for (const prod of prods) {
      const newSent = [...sent.slice(0, rmNT), ...prod.filter(p => p !== ''), ...sent.slice(rmNT + 1)];
      const key = newSent.join('|');
      if (!visited.has(key)) {
        visited.add(key);
        const prodStr = prod.join('') || 'ε';
        const newStep: DerivationStep = {
          sentential: newSent.join('') || 'ε',
          rule: `${nt} → ${prod.join('') || 'ε'}`,
          position: rmNT,
          explanation: `Replace rightmost non-terminal "${nt}" with "${prodStr}"`,
        };
        queue.push({ sent: newSent, steps: [...steps, newStep] });
      }
    }
  }
  return { steps: [], success: false, message: `Cannot derive "${targetString}" using rightmost derivation.` };
}

// Build a parse tree from derivation steps (approximation)
export function buildParseTree(grammar: Grammar, derivationSteps: DerivationStep[]): ParseTreeNode {
  // Start from root
  const root: ParseTreeNode = {
    symbol: grammar.startSymbol,
    children: [],
    isTerminal: false,
  };
  // Simplified: reconstruct tree from leftmost derivation steps
  // We do a recursive simulation
  const rulesMap = getRulesMap(grammar);
  const targetSent = derivationSteps.length > 0 ? derivationSteps[derivationSteps.length - 1].sentential : grammar.startSymbol;

  function expand(node: ParseTreeNode, available: string[]): number {
    if (node.isTerminal) return 1;
    const prods = rulesMap.get(node.symbol) || [];
    // We use BFS-guided expansion
    for (const prod of prods) {
      const filtered = prod.filter(p => p !== '');
      if (filtered.length === 0) {
        // epsilon production
        node.children = [{ symbol: 'ε', children: [], isTerminal: true }];
        return 0;
      }
      // Check if beginning of available matches
      let match = true;
      let offset = 0;
      for (const sym of filtered) {
        if (grammar.nonTerminals.has(sym)) {
          offset++; // placeholder - NT will consume some
        } else {
          if (available[offset] !== sym) { match = false; break; }
          offset++;
        }
      }
      if (match) {
        let pos = 0;
        for (const sym of filtered) {
          const child: ParseTreeNode = {
            symbol: sym,
            children: [],
            isTerminal: !grammar.nonTerminals.has(sym),
          };
          node.children.push(child);
          if (!child.isTerminal) {
            pos += expand(child, available.slice(pos));
          } else {
            pos++;
          }
        }
        return pos;
      }
    }
    return 0;
  }

  const targetChars = targetSent.split('');
  expand(root, targetChars);
  return root;
}

// CYK Algorithm for membership testing
export function cykMembership(grammar: Grammar, input: string): {
  accepted: boolean;
  table: { [key: string]: Set<string> };
  explanation: string[];
} {
  const explanation: string[] = [];
  if (input === '' || input === 'ε') {
    // Check if start symbol derives epsilon
    const hasEpsilon = grammar.rules.some(r => r.lhs === grammar.startSymbol && r.rhs.includes(''));
    return { accepted: hasEpsilon, table: {}, explanation: [`Checking if "${grammar.startSymbol}" derives ε: ${hasEpsilon}`] };
  }

  // Convert to CNF first for CYK (simplified - use as-is for unit/terminal rules too)
  const n = input.length;
  const chars = input.split('');
  // table[i][j] = set of NTs that derive chars[i..j]
  const table: Set<string>[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => new Set<string>()));

  const rulesMap = getRulesMap(grammar);

  // Fill base case
  for (let i = 0; i < n; i++) {
    for (const [nt, prods] of rulesMap) {
      for (const prod of prods) {
        if (prod.length === 1 && prod[0] === chars[i]) {
          table[i][i].add(nt);
        }
      }
    }
    explanation.push(`Position ${i} ("${chars[i]}"): {${[...table[i][i]].join(', ')}}`);
  }

  // Fill for lengths > 1
  for (let len = 2; len <= n; len++) {
    for (let i = 0; i <= n - len; i++) {
      const j = i + len - 1;
      for (let k = i; k < j; k++) {
        for (const [nt, prods] of rulesMap) {
          for (const prod of prods) {
            if (prod.length === 2) {
              const [B, C] = prod;
              if (table[i][k].has(B) && table[k + 1][j].has(C)) {
                table[i][j].add(nt);
              }
            }
          }
        }
      }
      if (table[i][j].size > 0) {
        explanation.push(`Span [${i},${j}] ("${chars.slice(i, j + 1).join('')}"): {${[...table[i][j]].join(', ')}}`);
      }
    }
  }

  const accepted = table[0][n - 1].has(grammar.startSymbol);
  explanation.push(accepted ? `✓ "${grammar.startSymbol}" found in table[0][${n - 1}] → ACCEPTED` : `✗ "${grammar.startSymbol}" NOT in table[0][${n - 1}] → REJECTED`);

  // Convert to object for display
  const tableObj: { [key: string]: Set<string> } = {};
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (table[i][j].size > 0) tableObj[`${i},${j}`] = table[i][j];
    }
  }

  return { accepted, table: tableObj, explanation };
}

// Grammar Simplification Steps
export function simplifyGrammar(grammar: Grammar): GrammarSimplificationStep[] {
  const steps: GrammarSimplificationStep[] = [];
  let currentRules = grammar.rules.map(r => ({ ...r, rhs: [...r.rhs] }));

  // Step 1: Remove epsilon productions
  const beforeEps = currentRules.map(r => ({ ...r, rhs: [...r.rhs] }));
  const nullable = findNullable(currentRules);
  currentRules = removeEpsilonProductions(currentRules, nullable, grammar.startSymbol);
  steps.push({
    name: 'Remove Epsilon Productions',
    description: `Nullable symbols: {${[...nullable].join(', ')}}. Added alternatives for each nullable symbol.`,
    before: beforeEps,
    after: currentRules.map(r => ({ ...r, rhs: [...r.rhs] })),
  });

  // Step 2: Remove unit productions
  const beforeUnit = currentRules.map(r => ({ ...r, rhs: [...r.rhs] }));
  currentRules = removeUnitProductions(currentRules, grammar.nonTerminals);
  steps.push({
    name: 'Remove Unit Productions',
    description: 'Replaced A → B with the productions of B transitively.',
    before: beforeUnit,
    after: currentRules.map(r => ({ ...r, rhs: [...r.rhs] })),
  });

  // Step 3: Remove useless symbols
  const beforeUseless = currentRules.map(r => ({ ...r, rhs: [...r.rhs] }));
  currentRules = removeUselessSymbols(currentRules, grammar.startSymbol, grammar.nonTerminals, grammar.terminals);
  steps.push({
    name: 'Remove Useless Symbols',
    description: 'Removed non-generating and non-reachable symbols.',
    before: beforeUseless,
    after: currentRules.map(r => ({ ...r, rhs: [...r.rhs] })),
  });

  // Step 4: CNF conversion
  const beforeCNF = currentRules.map(r => ({ ...r, rhs: [...r.rhs] }));
  currentRules = convertToCNF(currentRules, grammar.nonTerminals, grammar.terminals);
  steps.push({
    name: 'Convert to Chomsky Normal Form (CNF)',
    description: 'Each rule is now either A → BC or A → a.',
    before: beforeCNF,
    after: currentRules.map(r => ({ ...r, rhs: [...r.rhs] })),
  });

  return steps;
}

function findNullable(rules: CFGRule[]): Set<string> {
  const nullable = new Set<string>();
  // Direct epsilon productions
  for (const rule of rules) {
    if (rule.rhs.includes('')) nullable.add(rule.lhs);
  }
  // Transitive closure
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of rules) {
      if (!nullable.has(rule.lhs)) {
        for (const prod of rule.rhs) {
          if (prod !== '' && prod.split('').every(c => nullable.has(c))) {
            nullable.add(rule.lhs);
            changed = true;
          }
        }
      }
    }
  }
  return nullable;
}

function removeEpsilonProductions(rules: CFGRule[], nullable: Set<string>, start: string): CFGRule[] {
  const result: CFGRule[] = [];
  for (const rule of rules) {
    const newRhs = new Set<string>();
    for (const prod of rule.rhs) {
      if (prod === '') continue; // remove direct epsilon (re-add for start later)
      // Generate all combinations by omitting nullable symbols
      const combos = getEpsilonCombos(prod, nullable);
      for (const c of combos) newRhs.add(c);
    }
    const arr = [...newRhs];
    if (arr.length > 0) result.push({ lhs: rule.lhs, rhs: arr });
  }
  // If start symbol was nullable, add S → ε
  if (nullable.has(start)) {
    const startRule = result.find(r => r.lhs === start);
    if (startRule) startRule.rhs.push('');
    else result.push({ lhs: start, rhs: [''] });
  }
  return result;
}

function getEpsilonCombos(prod: string, nullable: Set<string>): string[] {
  // prod is a string of symbols
  const results = new Set<string>();
  function helper(i: number, current: string) {
    if (i === prod.length) {
      results.add(current);
      return;
    }
    const ch = prod[i];
    helper(i + 1, current + ch);
    if (nullable.has(ch)) {
      helper(i + 1, current); // omit nullable
    }
  }
  helper(0, '');
  results.delete('');
  return [...results];
}

function removeUnitProductions(rules: CFGRule[], nonTerminals: Set<string>): CFGRule[] {
  // For each NT A, find all NTs reachable by unit productions
  const unitMap = new Map<string, Set<string>>();
  for (const nt of nonTerminals) unitMap.set(nt, new Set([nt]));

  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of rules) {
      for (const prod of rule.rhs) {
        if (nonTerminals.has(prod)) {
          const reach = unitMap.get(rule.lhs)!;
          const newReach = unitMap.get(prod)!;
          for (const r of newReach) {
            if (!reach.has(r)) { reach.add(r); changed = true; }
          }
        }
      }
    }
  }

  const result: CFGRule[] = [];
  for (const [A, reachable] of unitMap) {
    const newRhs = new Set<string>();
    for (const B of reachable) {
      const BRule = rules.find(r => r.lhs === B);
      if (BRule) {
        for (const prod of BRule.rhs) {
          if (!nonTerminals.has(prod)) newRhs.add(prod); // non-unit
        }
      }
    }
    if (newRhs.size > 0) result.push({ lhs: A, rhs: [...newRhs] });
  }
  return result;
}

function removeUselessSymbols(rules: CFGRule[], start: string, nonTerminals: Set<string>, terminals: Set<string>): CFGRule[] {
  // Find generating symbols
  const generating = new Set<string>([...terminals, '']);
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of rules) {
      if (!generating.has(rule.lhs)) {
        for (const prod of rule.rhs) {
          if (prod.split('').every(c => generating.has(c) || nonTerminals.has(c) && generating.has(c))) {
            generating.add(rule.lhs);
            changed = true;
          }
        }
      }
    }
  }
  // Find reachable symbols
  const reachable = new Set<string>([start]);
  changed = true;
  while (changed) {
    changed = false;
    for (const rule of rules) {
      if (reachable.has(rule.lhs)) {
        for (const prod of rule.rhs) {
          for (const ch of prod.split('')) {
            if (!reachable.has(ch)) { reachable.add(ch); changed = true; }
          }
        }
      }
    }
  }
  return rules.filter(r => generating.has(r.lhs) && reachable.has(r.lhs))
    .map(r => ({
      lhs: r.lhs,
      rhs: r.rhs.filter(p => p.split('').every(c => generating.has(c) && reachable.has(c)) || p === ''),
    }))
    .filter(r => r.rhs.length > 0);
}

function convertToCNF(rules: CFGRule[], nonTerminals: Set<string>, _terminals: Set<string>): CFGRule[] {
  let counter = 0;
  const terminalNTMap = new Map<string, string>();
  const newRules: CFGRule[] = [];
  const allNTs = new Set(nonTerminals);

  function getTerminalNT(t: string): string {
    if (!terminalNTMap.has(t)) {
      const name = `T_${t.toUpperCase()}_${counter++}`;
      terminalNTMap.set(t, name);
      newRules.push({ lhs: name, rhs: [t] });
      allNTs.add(name);
    }
    return terminalNTMap.get(t)!;
  }

  const result: CFGRule[] = [];
  for (const rule of rules) {
    for (const prod of rule.rhs) {
      if (prod === '') { result.push({ lhs: rule.lhs, rhs: [''] }); continue; }
      const tokens = prod.split('').map(c => allNTs.has(c) ? c : getTerminalNT(c));
      if (tokens.length === 1) {
        result.push({ lhs: rule.lhs, rhs: [tokens[0]] });
      } else {
        // Binarize
        let lhs = rule.lhs;
        let remaining = tokens;
        while (remaining.length > 2) {
          const newNT = `X${counter++}`;
          allNTs.add(newNT);
          result.push({ lhs, rhs: [remaining[0] + remaining[1]] });
          // Actually we store as pair
          const pairNT = `X${counter++}`;
          allNTs.add(pairNT);
          newRules.push({ lhs: pairNT, rhs: [remaining.slice(1).join('')] });
          result.push({ lhs, rhs: [remaining[0] + pairNT] });
          lhs = pairNT;
          remaining = remaining.slice(1);
          break;
        }
        if (remaining.length === 2) {
          result.push({ lhs, rhs: [remaining[0] + remaining[1]] });
        } else if (remaining.length === 1) {
          result.push({ lhs, rhs: [remaining[0]] });
        }
      }
    }
  }

  return [...result, ...newRules];
}

// Ambiguity Detection: find two different parse trees for the same string
export function detectAmbiguity(grammar: Grammar, input: string): {
  isAmbiguous: boolean;
  derivation1: DerivationStep[];
  derivation2: DerivationStep[];
  explanation: string;
} {
  const lm = deriveLeftmost(grammar, input, 50);
  const rm = deriveRightmost(grammar, input, 50);

  if (!lm.success || !rm.success) {
    return { isAmbiguous: false, derivation1: [], derivation2: [], explanation: 'String is not in the language, so ambiguity is not applicable.' };
  }

  // Check if derivations differ at some step
  const differ = lm.steps.some((s, i) => rm.steps[i] && s.rule !== rm.steps[i].rule);
  return {
    isAmbiguous: differ,
    derivation1: lm.steps,
    derivation2: rm.steps,
    explanation: differ
      ? 'Two different derivation sequences found (leftmost vs rightmost produce different parse trees). The grammar is AMBIGUOUS.'
      : 'Leftmost and rightmost derivations follow the same structure. No ambiguity detected (not conclusive — grammar may still be ambiguous).',
  };
}

// Pumping Lemma simulation
export function simulatePumpingLemma(
  _grammar: Grammar,
  inputString: string,
  pumpingLength: number
): { parts: { u: string; v: string; w: string }; pumped: { [k: number]: string }; explanation: string[] } {
  const explanation: string[] = [];
  const s = inputString;
  const n = pumpingLength;

  if (s.length < n) {
    explanation.push(`The string "${s}" has length ${s.length} which is less than pumping length p=${n}. Cannot apply pumping lemma.`);
    return { parts: { u: '', v: '', w: s }, pumped: {}, explanation };
  }

  // Split into uvw where |uv| ≤ n, |v| ≥ 1
  const u = s.slice(0, Math.floor(n / 3));
  const v = s.slice(Math.floor(n / 3), Math.floor(2 * n / 3));
  const w = s.slice(Math.floor(2 * n / 3));

  explanation.push(`String s = "${s}", length = ${s.length}`);
  explanation.push(`Split: u = "${u}", v = "${v}", w = "${w}"`);
  explanation.push(`|uv| = ${u.length + v.length} ≤ p = ${n}: ✓`);
  explanation.push(`|v| = ${v.length} ≥ 1: ${v.length >= 1 ? '✓' : '✗'}`);

  const pumped: { [k: number]: string } = {};
  for (const k of [0, 1, 2, 3]) {
    const pumped_str = u + v.repeat(k) + w;
    pumped[k] = pumped_str;
    explanation.push(`pump(${k}): "${pumped_str}" (uv${k}w)`);
  }

  return { parts: { u, v, w }, pumped, explanation };
}

// ───────────────── NEW ADVANCED FEATURES ─────────────────

// Random String Generator: produce a valid string with its derivation trace
export function generateRandomString(
  grammar: Grammar,
  maxDepth = 8,
  maxAttempts = 200
): { string: string; derivation: DerivationStep[]; success: boolean } {
  const rulesMap = getRulesMap(grammar);

  function expand(tokens: string[], depth: number, steps: DerivationStep[]): string[] | null {
    if (depth > maxDepth) return null;
    const ntIdx = tokens.findIndex(t => grammar.nonTerminals.has(t));
    if (ntIdx === -1) return tokens; // all terminals
    const nt = tokens[ntIdx];
    const prods = rulesMap.get(nt) || [];
    if (prods.length === 0) return null;
    // pick a random production (bias toward shorter ones to avoid blowup)
    const sorted = [...prods].sort((a, b) => a.length - b.length);
    const idx = Math.random() < 0.6 ? 0 : Math.floor(Math.random() * sorted.length);
    const chosen = sorted[idx];
    const filtered = chosen.filter(p => p !== '');
    const newTokens = [...tokens.slice(0, ntIdx), ...filtered, ...tokens.slice(ntIdx + 1)];
    const prodStr = chosen.join('') || 'ε';
    steps.push({
      sentential: newTokens.join('') || 'ε',
      rule: `${nt} → ${prodStr}`,
      position: ntIdx,
      explanation: `Expand "${nt}" using ${nt} → ${prodStr}`,
    });
    return expand(newTokens, depth + 1, steps);
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const steps: DerivationStep[] = [];
    const result = expand([grammar.startSymbol], 0, steps);
    if (result !== null && !result.some(t => grammar.nonTerminals.has(t))) {
      return { string: result.join(''), derivation: steps, success: true };
    }
  }
  return { string: '', derivation: [], success: false };
}

// Full 2D CYK table (returns n×n cell array for grid visualization)
export interface CYKCell {
  nonterminals: string[];
  row: number; // i
  col: number; // j
  substring: string;
}

export function cykFull(
  grammar: Grammar,
  input: string
): { accepted: boolean; cells: CYKCell[][]; explanation: string[] } {
  const explanation: string[] = [];
  if (input === '' || input === 'ε') {
    const hasEps = grammar.rules.some(r => r.lhs === grammar.startSymbol && r.rhs.includes(''));
    return {
      accepted: hasEps,
      cells: [],
      explanation: [`Checking if start symbol derives ε: ${hasEps}`],
    };
  }

  const n = input.length;
  const chars = input.split('');
  const table: Set<string>[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => new Set<string>())
  );
  const rulesMap = getRulesMap(grammar);

  // Base: single characters
  for (let i = 0; i < n; i++) {
    for (const [nt, prods] of rulesMap) {
      for (const prod of prods) {
        if (prod.length === 1 && prod[0] === chars[i]) table[i][i].add(nt);
      }
    }
    explanation.push(`[${i},${i}] "${chars[i]}": {${[...table[i][i]].join(', ')}}`);
  }

  // Fill longer spans
  for (let len = 2; len <= n; len++) {
    for (let i = 0; i <= n - len; i++) {
      const j = i + len - 1;
      for (let k = i; k < j; k++) {
        for (const [nt, prods] of rulesMap) {
          for (const prod of prods) {
            if (prod.length === 2) {
              const [B, C] = prod;
              if (table[i][k].has(B) && table[k + 1][j].has(C)) table[i][j].add(nt);
            }
          }
        }
      }
      if (table[i][j].size > 0)
        explanation.push(`[${i},${j}] "${chars.slice(i, j + 1).join('')}": {${[...table[i][j]].join(', ')}}`);
    }
  }

  const accepted = table[0][n - 1].has(grammar.startSymbol);
  explanation.push(accepted ? `✓ ACCEPTED — "${grammar.startSymbol}" ∈ table[0][${n - 1}]` : `✗ REJECTED — "${grammar.startSymbol}" ∉ table[0][${n - 1}]`);

  // Build cells matrix
  const cells: CYKCell[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => ({
      nonterminals: [...table[i][j]],
      row: i,
      col: j,
      substring: j >= i ? chars.slice(i, j + 1).join('') : '',
    }))
  );

  return { accepted, cells, explanation };
}

// Multiple Derivation Paths: return several distinct leftmost derivation sequences
export interface DerivationPath {
  steps: DerivationStep[];
  id: number;
}

export function getDerivationPaths(
  grammar: Grammar,
  targetString: string,
  maxPaths = 5,
  maxSteps = 80
): DerivationPath[] {
  const rulesMap = getRulesMap(grammar);
  const results: DerivationPath[] = [];
  const seenSequences = new Set<string>();

  // DFS-style with backtracking to find multiple paths
  function dfs(sent: string[], steps: DerivationStep[]): void {
    if (results.length >= maxPaths) return;
    if (steps.length > maxSteps) return;

    const sentStr = sent.join('');
    if (sentStr === targetString && !sent.some(s => grammar.nonTerminals.has(s))) {
      const key = steps.map(s => s.rule).join('|');
      if (!seenSequences.has(key)) {
        seenSequences.add(key);
        results.push({ steps: [...steps], id: results.length });
      }
      return;
    }

    // If it's already fully terminal but wrong
    if (!sent.some(s => grammar.nonTerminals.has(s))) return;
    // If it's longer than target, prune
    const terminals = sent.filter(s => !grammar.nonTerminals.has(s));
    if (terminals.join('').length > targetString.length) return;

    const lmNT = sent.findIndex(s => grammar.nonTerminals.has(s));
    if (lmNT === -1) return;
    const nt = sent[lmNT];
    const prods = rulesMap.get(nt) || [];

    for (const prod of prods) {
      const filtered = prod.filter(p => p !== '');
      const newSent = [...sent.slice(0, lmNT), ...filtered, ...sent.slice(lmNT + 1)];
      const prodStr = prod.join('') || 'ε';
      const step: DerivationStep = {
        sentential: newSent.join('') || 'ε',
        rule: `${nt} → ${prodStr}`,
        position: lmNT,
        explanation: `Replace "${nt}" with "${prodStr}"`,
      };
      dfs(newSent, [...steps, step]);
      if (results.length >= maxPaths) return;
    }
  }

  dfs([grammar.startSymbol], []);
  return results;
}

// Grammar Equivalence Heuristic: generate N random strings from each grammar and compare membership
export interface GrammarEquivalenceResult {
  sampleSize: number;
  onlyInG1: string[];
  onlyInG2: string[];
  inBoth: string[];
  likelyEquivalent: boolean;
  explanation: string;
}

export function grammarEquivalenceHeuristic(
  grammar1: Grammar,
  grammar2: Grammar,
  sampleSize = 30
): GrammarEquivalenceResult {
  const allStrings = new Set<string>();

  // Generate from g1
  for (let i = 0; i < sampleSize; i++) {
    const { string: s, success } = generateRandomString(grammar1, 6, 30);
    if (success && s) allStrings.add(s);
  }
  // Generate from g2
  for (let i = 0; i < sampleSize; i++) {
    const { string: s, success } = generateRandomString(grammar2, 6, 30);
    if (success && s) allStrings.add(s);
  }

  const onlyInG1: string[] = [];
  const onlyInG2: string[] = [];
  const inBoth: string[] = [];

  for (const s of allStrings) {
    const { accepted: a1 } = cykMembership(grammar1, s);
    const { accepted: a2 } = cykMembership(grammar2, s);
    if (a1 && a2) inBoth.push(s);
    else if (a1) onlyInG1.push(s);
    else if (a2) onlyInG2.push(s);
  }

  const likelyEquivalent = onlyInG1.length === 0 && onlyInG2.length === 0;
  const explanation = likelyEquivalent
    ? `Tested ${allStrings.size} strings. No differences found — grammars appear equivalent (heuristic, not conclusive).`
    : `Found ${onlyInG1.length} strings only in G1 and ${onlyInG2.length} strings only in G2. Grammars are NOT equivalent.`;

  return { sampleSize: allStrings.size, onlyInG1, onlyInG2, inBoth, likelyEquivalent, explanation };
}

// Pumping Lemma Proof Steps for CFLs
// Returns a structured sequence of proof steps for interactive guidance
export interface PumpingProofState {
  s: string;         // The string being pumped
  p: number;         // Pumping length
  u: string; v: string; x: string; y: string; w: string; // uvxyw decomposition
  pumpedStrings: Record<number, string>;
}

export interface PumpingLemmaProofStep {
  id: string;
  title: string;
  description: string;
  hint: string;
  infoContent?: string;
  isInfo?: boolean;
  validate?: (input: string, state: Partial<PumpingProofState>) => {
    valid: boolean; message: string; explanation?: string;
    update?: Partial<PumpingProofState>;
  };
  inputPlaceholder?: string;
  inputType?: 'text' | 'number';
}

export function buildPumpingLemmaProofSteps(
  grammar: Grammar,
  defaultString = 'aabb',
  defaultP = 3
): PumpingLemmaProofStep[] {
  return [
    {
      id: 'assume_cfl',
      title: 'Assume L is a CFL',
      isInfo: true,
      description: 'We start by assuming the language is context-free, leading to a contradiction.',
      hint: 'The pumping lemma is a proof by contradiction.',
      infoContent: `Assume L is a CFL. By the Pumping Lemma for CFLs, there exists a pumping length p ≥ 1 such that every string s ∈ L with |s| ≥ p can be written as s = uvxyw where:\n  1. |vy| ≥ 1\n  2. |vxy| ≤ p\n  3. For all i ≥ 0, uv^i xy^i w ∈ L`,
    },
    {
      id: 'choose_string',
      title: 'Choose your string s',
      description: 'Enter a string from the language that you want to pump. It must be long enough (|s| ≥ p).',
      hint: `For the grammar "${grammar.rules.map(r => `${r.lhs} → ${r.rhs.join('|')}`).join(', ')}", try a string like "aabb" or make it longer, e.g. "aaabbb".`,
      inputPlaceholder: defaultString,
      inputType: 'text',
      validate: (input, _state) => {
        if (!input || input.length === 0) return { valid: false, message: 'Enter a non-empty string.' };
        const { success } = deriveLeftmost(grammar, input, 80);
        if (!success) return {
          valid: false, message: `"${input}" is not in the language L(G). Choose a string that the grammar generates.`,
          explanation: `Run the derivation or membership tab to check if a string is in L(G).`,
        };
        return { valid: true, message: `Good — "${input}" ∈ L(G). Now choose a pumping length.`, update: { s: input } };
      },
    },
    {
      id: 'choose_p',
      title: 'Choose pumping length p',
      description: 'Choose the pumping length p (must be ≤ length of your string). This represents the adversary\'s choice.',
      hint: 'A common choice is p = half the length of your string. The adversary (the CFL pumping lemma) will pick the decomposition.',
      inputPlaceholder: String(defaultP),
      inputType: 'number',
      validate: (input, state) => {
        const p = parseInt(input, 10);
        if (isNaN(p) || p < 1) return { valid: false, message: 'p must be a positive integer.' };
        const s = state.s ?? '';
        if (p > s.length) return { valid: false, message: `p=${p} must be ≤ |s|=${s.length}.` };
        return { valid: true, message: `p = ${p} accepted. Now decompose s = uvxyw.`, update: { p } };
      },
    },
    {
      id: 'decompose',
      title: 'Decompose s = uvxyw',
      description: 'The adversary picks a decomposition. Enter the 5 parts separated by commas: u,v,x,y,w (where v,y are the pumped parts, vxy ≤ p, and |vy| ≥ 1).',
      hint: 'The adversary chooses the worst decomposition for you. Try to show that pumping breaks membership for ALL valid decompositions.',
      inputPlaceholder: 'ε,a,ε,b,ε  (use ε for empty)',
      inputType: 'text',
      validate: (input, state) => {
        const parts = input.split(',').map(p => p.trim().replace(/^ε$/, ''));
        if (parts.length !== 5) return { valid: false, message: 'Provide exactly 5 parts: u, v, x, y, w separated by commas.' };
        const [u, v, x, y, w] = parts;
        const s = state.s ?? '';
        const p = state.p ?? 1;
        if (u + v + x + y + w !== s) return {
          valid: false,
          message: `u+v+x+y+w = "${u+v+x+y+w}" ≠ s = "${s}".`,
          explanation: 'The five parts must concatenate to your original string.',
        };
        if (v.length + y.length < 1) return { valid: false, message: '|vy| must be ≥ 1.' };
        if (v.length + x.length + y.length > p) return {
          valid: false, message: `|vxy| = ${v.length+x.length+y.length} > p = ${p}.`,
        };
        const pumped: Record<number, string> = {};
        for (const i of [0, 1, 2, 3]) pumped[i] = u + v.repeat(i) + x + y.repeat(i) + w;
        return { valid: true, message: 'Decomposition valid! Now pump and check membership.', update: { u, v, x, y, w, pumpedStrings: pumped } };
      },
    },
    {
      id: 'pump_check',
      title: 'Find a pump value i that fails',
      description: 'Enter a value of i (0, 2, 3, …). The pumped string uv^i xy^i w should NOT be in the language to prove the contradiction.',
      hint: 'Try i=0 (removes v and y) or i=2 (adds extra copies). One of these usually breaks the language condition.',
      inputPlaceholder: '0',
      inputType: 'number',
      validate: (input, state) => {
        const i = parseInt(input, 10);
        if (isNaN(i) || i < 0) return { valid: false, message: 'i must be a non-negative integer.' };
        const { u='', v='', x='', y='', w='' } = state;
        const pumped = u + v.repeat(i) + x + y.repeat(i) + w;
        const { success } = deriveLeftmost(grammar, pumped, 80);
        if (success) return {
          valid: false,
          message: `uv^${i}xy^${i}w = "${pumped}" is still in L(G). Try a different i.`,
          explanation: 'You need to find an i where the pumped string leaves the language.',
        };
        return {
          valid: true,
          message: `✓ Contradiction! uv^${i}xy^${i}w = "${pumped}" ∉ L(G), but the pumping lemma says it should be!`,
        };
      },
    },
    {
      id: 'conclude',
      title: 'State the conclusion',
      description: 'What does this contradiction tell us?',
      hint: 'We assumed L is a CFL, but the pumping lemma was violated → contradiction → L is not a CFL.',
      isInfo: true,
      infoContent: 'Since we found a string s ∈ L with |s| ≥ p, and for the adversary\'s decomposition s = uvxyw, pumping produces a string NOT in L — this contradicts the pumping lemma. Therefore, L is NOT a context-free language. □',
    },
  ];
}

// Inherent ambiguity examples and explanations
export interface AmbiguityExample {
  name: string;
  grammar: string;
  startSymbol: string;
  testString: string;
  explanation: string;
  isInherentlyAmbiguous: boolean;
}

export const AMBIGUITY_EXAMPLES: AmbiguityExample[] = [
  {
    name: 'Classic Ambiguous (Arithmetic)',
    grammar: 'E -> E+E | E*E | a',
    startSymbol: 'E',
    testString: 'a+a*a',
    explanation: 'This grammar is ambiguous: "a+a*a" has two parse trees (add first, or multiply first). But an unambiguous version exists (with precedence rules), so this is NOT inherently ambiguous.',
    isInherentlyAmbiguous: false,
  },
  {
    name: 'Inherently Ambiguous Language',
    grammar: 'S -> AB | DC\nA -> aA | a\nB -> bBc | bc\nD -> aDb | ab\nC -> cC | c',
    startSymbol: 'S',
    testString: 'abc',
    explanation: 'L = {aⁿbⁿcᵐ | n,m≥1} ∪ {aⁿbᵐcᵐ | n,m≥1} is inherently ambiguous. Strings of the form aⁿbⁿcⁿ belong to both sublanguages and MUST have at least two parse trees in any grammar for L. No unambiguous grammar exists.',
    isInherentlyAmbiguous: true,
  },
  {
    name: 'Balanced Parentheses (Unambiguous)',
    grammar: 'S -> SS | (S) | ε',
    startSymbol: 'S',
    testString: '(())',
    explanation: 'This grammar for balanced parentheses IS ambiguous (multiple parse trees for some strings), but an unambiguous version can be written. The language itself is not inherently ambiguous.',
    isInherentlyAmbiguous: false,
  },
];

