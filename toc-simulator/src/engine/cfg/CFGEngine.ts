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

export type CFGExampleCategory = 'basic' | 'structured' | 'expression' | 'ambiguous';

export interface CFGExample {
  name: string;
  category: CFGExampleCategory;
  description: string;
  educationalNotes: string;
  definition: string;
  startSymbol: string;
  input: string;
}

export const CFG_DEFAULT_MAX_STEPS = 120;

export const CFG_EXAMPLES: CFGExample[] = [
  {
    name: 'a^n b^n',
    category: 'basic',
    description: 'Generates equal numbers of a followed by b.',
    educationalNotes: 'Each expansion adds one a to the left and one b to the right, then eventually closes with epsilon.',
    definition: 'S -> aSb | ε',
    startSymbol: 'S',
    input: 'aaabbb',
  },
  {
    name: 'Balanced parentheses',
    category: 'structured',
    description: 'Builds correctly nested and concatenated parentheses.',
    educationalNotes: 'Use S -> (S) for nesting, S -> SS for concatenation, and epsilon to stop.',
    definition: 'S -> SS | (S) | ε',
    startSymbol: 'S',
    input: '(()())',
  },
  {
    name: 'Arithmetic expressions',
    category: 'expression',
    description: 'Expression grammar with operator precedence style layers.',
    educationalNotes: 'E handles + terms, T handles * factors, and F handles parentheses and identifiers.',
    definition: "E -> E+T | T\nT -> T*F | F\nF -> (E) | id",
    startSymbol: 'E',
    input: 'id+id*id',
  },
  {
    name: 'Palindromes',
    category: 'structured',
    description: 'Generates palindromes over alphabet {a, b}.',
    educationalNotes: 'Grow from the center using aSa and bSb, with base cases a, b, and epsilon.',
    definition: 'S -> aSa | bSb | a | b | ε',
    startSymbol: 'S',
    input: 'abba',
  },
  {
    name: 'Simple ambiguous grammar',
    category: 'ambiguous',
    description: 'No precedence between + and * creates ambiguity.',
    educationalNotes: 'The same string can be derived in multiple valid ways, producing different parse trees.',
    definition: 'E -> E+E | E*E | id',
    startSymbol: 'E',
    input: 'id+id*id',
  },
];

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

// Build a parse tree by replaying derivation steps.
// This avoids unbounded recursion for left-recursive grammars.
export function buildParseTree(grammar: Grammar, derivationSteps: DerivationStep[]): ParseTreeNode {
  const root: ParseTreeNode = {
    symbol: grammar.startSymbol,
    children: [],
    isTerminal: false,
  };

  // Frontier tracks current sentential leaves in left-to-right order.
  let frontier: ParseTreeNode[] = [root];

  for (const step of derivationSteps) {
    const ruleMatch = step.rule.match(/^(.+?)\s*→\s*(.+)$/);
    if (!ruleMatch) continue;

    const lhs = ruleMatch[1].trim();
    const rhsText = ruleMatch[2].trim();

    let expandIndex = step.position;
    if (
      expandIndex < 0 ||
      expandIndex >= frontier.length ||
      frontier[expandIndex].symbol !== lhs
    ) {
      expandIndex = frontier.findIndex((node) => !node.isTerminal && node.symbol === lhs);
      if (expandIndex === -1) continue;
    }

    const targetNode = frontier[expandIndex];
    const isEpsilon = rhsText === 'ε' || rhsText === 'eps' || rhsText === '';

    if (isEpsilon) {
      targetNode.children = [{ symbol: 'ε', children: [], isTerminal: true }];
      frontier = [...frontier.slice(0, expandIndex), ...frontier.slice(expandIndex + 1)];
      continue;
    }

    const rhsTokens = tokenizeProduction(rhsText, grammar.nonTerminals).filter((token) => token !== '');
    const childNodes = rhsTokens.map((token) => ({
      symbol: token,
      children: [],
      isTerminal: !grammar.nonTerminals.has(token),
    }));

    targetNode.children = childNodes;
    frontier = [
      ...frontier.slice(0, expandIndex),
      ...childNodes,
      ...frontier.slice(expandIndex + 1),
    ];
  }

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



