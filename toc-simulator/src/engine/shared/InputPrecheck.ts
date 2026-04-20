export type SimulatorKind = 'cfg' | 'pda' | 'tm';

function isABChar(ch: string): boolean {
  return ch === 'a' || ch === 'b';
}

function rejectAnBn(input: string): boolean {
  const n = input.length;
  let i = 0;
  let countA = 0;
  let countB = 0;

  while (i < n && input[i] === 'a') {
    countA += 1;
    i += 1;
  }

  while (i < n && input[i] === 'b') {
    countB += 1;
    i += 1;
  }

  if (i !== n) return true;
  return countA !== countB;
}

function rejectBalancedParentheses(input: string): boolean {
  let balance = 0;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '(') {
      balance += 1;
    } else if (ch === ')') {
      balance -= 1;
    } else {
      return true;
    }

    if (balance < 0) return true;
  }

  return balance !== 0;
}

function rejectEqualAB(input: string): boolean {
  let countA = 0;
  let countB = 0;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === 'a') {
      countA += 1;
    } else if (ch === 'b') {
      countB += 1;
    } else {
      return true;
    }
  }

  return countA !== countB;
}

function rejectSimplePalindromeAB(input: string): boolean {
  for (let i = 0; i < input.length; i += 1) {
    if (!isABChar(input[i])) return true;
  }

  let left = 0;
  let right = input.length - 1;
  while (left < right) {
    if (input[left] !== input[right]) return true;
    left += 1;
    right -= 1;
  }

  return false;
}

function rejectCenterMarkedPalindrome(input: string): boolean {
  let centerIndex = -1;
  let centerCount = 0;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (ch === 'c') {
      centerCount += 1;
      if (centerIndex < 0) centerIndex = i;
      continue;
    }

    if (!isABChar(ch)) return true;
  }

  if (centerCount !== 1 || centerIndex < 0) return true;

  let left = 0;
  let right = input.length - 1;
  while (left < centerIndex && right > centerIndex) {
    if (input[left] !== input[right]) return true;
    left += 1;
    right -= 1;
  }

  return left !== centerIndex || right !== centerIndex;
}

function rejectAnBmCm(input: string): boolean {
  const n = input.length;
  let i = 0;
  let countB = 0;
  let countC = 0;

  while (i < n && input[i] === 'a') {
    i += 1;
  }

  while (i < n && input[i] === 'b') {
    countB += 1;
    i += 1;
  }

  while (i < n && input[i] === 'c') {
    countC += 1;
    i += 1;
  }

  if (i !== n) return true;
  return countB !== countC;
}

export function shouldFastRejectInput(kind: SimulatorKind, exampleName: string | null | undefined, input: string): boolean {
  if (!exampleName) return false;

  const name = exampleName.trim().toLowerCase();

  if (name === 'a^n b^n' || name === 'a^n b^n recognizer') {
    return rejectAnBn(input);
  }

  if (name === 'balanced parentheses') {
    return rejectBalancedParentheses(input);
  }

  if (name === "equal number of a's and b's") {
    return rejectEqualAB(input);
  }

  if (name === 'a^n b^m c^m') {
    return rejectAnBmCm(input);
  }

  if (name === 'palindromes') {
    return rejectSimplePalindromeAB(input);
  }

  if (name === 'palindrome checker') {
    return kind === 'pda' ? rejectCenterMarkedPalindrome(input) : rejectSimplePalindromeAB(input);
  }

  return false;
}
