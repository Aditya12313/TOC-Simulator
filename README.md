# Theory of Computation Simulator 🎓

## Overview

The Theory of Computation Simulator is an interactive web-based platform designed to visualize and understand core computational models:

- Context-Free Grammar (CFG)
- Pushdown Automata (PDA)
- Turing Machine (TM)

The system emphasizes clarity, correctness, and step-by-step execution, allowing users to explore how abstract computational models operate in practice.

---

## Objectives

- To provide an intuitive interface for exploring formal computation models  
- To bridge the gap between theoretical concepts and practical understanding  
- To enable step-by-step visualization of computation processes  
- To ensure correctness through structured simulation and validation  

---

## Key Features

### Context-Free Grammar (CFG) 🌳

- Step-by-step derivation (Leftmost & Rightmost)
- Dedicated Parse Tree visualization (separate section)
- Membership testing for input strings
- Predefined grammar examples:
  - aⁿbⁿ
  - Balanced parentheses
  - Arithmetic expressions
  - Palindromes
- Editable grammar rules and input strings
- Fast mode and step execution

---

### Pushdown Automata (PDA) 📚

- Stack-based computation visualization
- Step-by-step execution with stack updates
- Acceptance by:
  - Final State
  - Empty Stack
- Execution trace panel
- Predefined examples:
  - aⁿbⁿ recognizer
  - Balanced parentheses
  - Equal number of a’s and b’s
  - Palindrome checker
  - aⁿbᵐcᵐ
- Strict acceptance logic using transitions (no external shortcuts)
- Membership section for validation
- Fast mode and step execution

---

### Turing Machine (TM) 🎞️

- Tape-based computation visualization
- Dynamic tape rendering with head movement
- Step-by-step and fast execution modes
- Loop detection and step limit safeguards
- Execution trace panel
- Predefined machines:
  - String reversal
  - Binary increment
  - Palindrome checker
  - Unary addition / subtraction
  - Even number of 1s
- Membership-based result evaluation

---

## System Design 🧠

The simulator is structured into three layers:

- **Input Layer** → User-defined grammar, automaton, or machine  
- **Simulation Engine** → Executes transitions and computations  
- **Visualization Layer** → Displays derivations, stack, and tape  

### Layout Structure

- **Left Panel** → Example explorer & input configuration  
- **Center Panel** → Visualization (Tree / Stack / Tape)  
- **Right Panel** → Execution trace and explanations  
- **Bottom Control Bar** → Persistent execution controls  

---

## Execution Controls 🎮

A unified control system is provided across all modules:

- Run  
- Step  
- Pause  
- Reset  
- Speed Control (0.5x / 1x / 2x)

Controls are fixed at the bottom center for consistent accessibility.

---

## Performance & Stability ⚙️

To ensure smooth execution:

- Step limits prevent infinite computation  
- Loop detection avoids non-terminating behavior  
- Asynchronous execution prevents UI freezing  
- Fail-fast validation filters invalid inputs early  
- Partial rendering (e.g., tape window) improves performance  

---

## Correctness Approach ✅

The simulator ensures correctness using:

- Formal transition-based computation  
- Strict acceptance conditions:
  - Input must be fully consumed  
  - Acceptance by final state or empty stack  
- Internal structural validation (hidden from UI) to prevent false acceptance  

---

## Usage 🧪

1. Select a simulator (CFG / PDA / TM)  
2. Choose a predefined example or define your own  
3. Enter an input string  
4. Run simulation using:
   - Step Mode → detailed execution  
   - Fast Mode → instant result  
5. Observe visualization and execution trace  

---


## Technologies Used 💻

- React (Frontend UI)
- TypeScript (Type safety)
- Tailwind CSS (Styling)
- Vite (Build tool)

---

## Limitations ⚠️

- CFG ambiguity detection is limited to demonstration level  
- PDA nondeterminism visualization is simplified  
- Turing Machine execution is bounded by step limits  
- Extremely large inputs may still require optimization  

---

## Future Enhancements 🚀

- Enhanced visualization for derivation trees  
- Improved nondeterministic PDA visualization  
- Additional predefined examples  
- Export/import configurations  
- Accessibility improvements  

---

## Conclusion

This project provides a unified and interactive platform to explore Theory of Computation concepts. By combining visualization, structured simulation, and performance safeguards, it serves as an effective educational tool for understanding formal computational models.

---

## Author

Aditya Deshmukh  
