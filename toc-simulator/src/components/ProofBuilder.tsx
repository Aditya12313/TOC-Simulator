// ProofBuilder.tsx — Interactive step-by-step proof assistant UI
// Guides users through pumping lemma proofs, membership proofs with hints and validation

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, HelpCircle, ChevronRight, Lightbulb } from 'lucide-react';

export interface ProofStep {
  id: string;
  title: string;
  description: string;        // What the user must do
  hint: string;               // Shown on demand
  validate?: (userInput: string, context: ProofContext) => ProofValidation;
  inputPlaceholder?: string;
  inputType?: 'text' | 'number' | 'choice';
  choices?: string[];         // For 'choice' type
  isInfo?: boolean;           // Non-interactive info step
  infoContent?: string;       // Shown directly (no input needed)
}

export interface ProofValidation {
  valid: boolean;
  message: string;
  explanation?: string;       // Shown on incorrect answer
}

export interface ProofContext {
  [key: string]: string | number;
}

interface ProofBuilderProps {
  title: string;
  description: string;
  steps: ProofStep[];
  accentColor?: string;
  onComplete?: (context: ProofContext) => void;
}

interface StepState {
  status: 'pending' | 'active' | 'correct' | 'incorrect' | 'skipped';
  userInput: string;
  validation?: ProofValidation;
  hintsUsed: number;
}

export default function ProofBuilder({
  title,
  description,
  steps,
  accentColor = 'var(--cfg)',
  onComplete,
}: ProofBuilderProps) {
  const [stepStates, setStepStates] = useState<Record<string, StepState>>(() => {
    const init: Record<string, StepState> = {};
    for (const s of steps) {
      init[s.id] = { status: 'pending', userInput: '', hintsUsed: 0 };
    }
    if (steps.length > 0) init[steps[0].id].status = 'active';
    return init;
  });
  const [context, setContext] = useState<ProofContext>({});
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  const [completedAll, setCompletedAll] = useState(false);

  function submitStep(step: ProofStep, input: string) {
    let validation: ProofValidation;

    if (step.isInfo) {
      validation = { valid: true, message: 'Understood!' };
    } else if (step.validate) {
      validation = step.validate(input, context);
    } else {
      validation = { valid: true, message: 'Step recorded.' };
    }

    const newContext = { ...context, [step.id]: input };
    setContext(newContext);

    setStepStates(prev => {
      const next = { ...prev };
      next[step.id] = {
        ...next[step.id],
        status: validation.valid ? 'correct' : 'incorrect',
        userInput: input,
        validation,
      };
      // Activate next step if correct
      if (validation.valid) {
        const idx = steps.findIndex(s => s.id === step.id);
        if (idx < steps.length - 1) {
          next[steps[idx + 1].id] = { ...next[steps[idx + 1].id], status: 'active' };
        } else {
          setCompletedAll(true);
          onComplete?.(newContext);
        }
      }
      return next;
    });
  }

  function retryStep(stepId: string) {
    setStepStates(prev => ({
      ...prev,
      [stepId]: { ...prev[stepId], status: 'active', validation: undefined, userInput: '' },
    }));
  }

  const completedCount = steps.filter(s => stepStates[s.id]?.status === 'correct').length;
  const progressPct = (completedCount / steps.length) * 100;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card p-4" style={{ borderLeft: `4px solid ${accentColor}` }}>
        <p className="font-bold text-[var(--ink)] mb-1" style={{ color: accentColor }}>{title}</p>
        <p className="text-xs text-[var(--ink-3)] font-mono leading-relaxed">{description}</p>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 rounded-full bg-[var(--bg-2)] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: accentColor }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <p className="text-[10px] text-[var(--ink-3)] font-mono mt-1">
          {completedCount} / {steps.length} steps complete
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, idx) => {
          const state = stepStates[step.id];
          const isActive = state?.status === 'active';
          const isCorrect = state?.status === 'correct';
          const isIncorrect = state?.status === 'incorrect';
          const isPending = state?.status === 'pending';
          const hintVisible = showHint[step.id];

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`card p-4 transition-all duration-200 ${
                isPending ? 'opacity-40' : ''
              } ${isActive ? 'border-2' : ''}`}
              style={isActive ? { borderColor: accentColor } : {}}
            >
              {/* Step header */}
              <div className="flex items-start gap-2 mb-2">
                <div className="flex-shrink-0 mt-0.5">
                  {isCorrect ? (
                    <CheckCircle size={14} className="text-green-500" />
                  ) : isIncorrect ? (
                    <XCircle size={14} className="text-red-500" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border-2 mt-0.5"
                      style={{ borderColor: isActive ? accentColor : 'var(--border)' }} />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-[var(--ink)] mb-0.5">
                    Step {idx + 1}: {step.title}
                  </p>
                  <p className="text-[11px] text-[var(--ink-3)] font-mono leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Info content */}
              {step.isInfo && isActive && (
                <div className="mt-2 p-3 rounded-lg bg-[var(--bg-2)] border border-[var(--border)]">
                  <p className="text-xs font-mono text-[var(--ink-2)] leading-relaxed">
                    {step.infoContent}
                  </p>
                  <button
                    onClick={() => submitStep(step, 'understood')}
                    className="mt-2 text-xs font-bold font-mono flex items-center gap-1"
                    style={{ color: accentColor }}
                  >
                    Understood <ChevronRight size={12} />
                  </button>
                </div>
              )}

              {/* Input area for active non-info steps */}
              {!step.isInfo && isActive && (
                <div className="mt-3 space-y-2">
                  {step.inputType === 'choice' && step.choices ? (
                    <div className="flex flex-wrap gap-1.5">
                      {step.choices.map(choice => (
                        <button
                          key={choice}
                          onClick={() => submitStep(step, choice)}
                          className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border border-[var(--border)] hover:border-[var(--ink-3)] transition-all"
                          style={{ background: 'var(--bg-2)', color: 'var(--ink)' }}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <StepInput
                      placeholder={step.inputPlaceholder ?? 'Your answer…'}
                      accentColor={accentColor}
                      onSubmit={(val) => submitStep(step, val)}
                      inputType={step.inputType ?? 'text'}
                    />
                  )}

                  {/* Hint button */}
                  <button
                    onClick={() => setShowHint(prev => ({ ...prev, [step.id]: !prev[step.id] }))}
                    className="flex items-center gap-1 text-[11px] font-mono opacity-60 hover:opacity-100 transition-opacity"
                    style={{ color: accentColor }}
                  >
                    <HelpCircle size={11} />
                    {hintVisible ? 'Hide hint' : 'Show hint'}
                  </button>

                  <AnimatePresence>
                    {hintVisible && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="flex items-start gap-2 p-2.5 rounded-lg"
                        style={{ background: `color-mix(in srgb, ${accentColor} 8%, transparent)`, border: `1px solid ${accentColor}` }}
                      >
                        <Lightbulb size={12} style={{ color: accentColor, flexShrink: 0, marginTop: 1 }} />
                        <p className="text-[11px] font-mono leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                          {step.hint}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Validation feedback */}
              <AnimatePresence>
                {(isCorrect || isIncorrect) && state?.validation && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="mt-2 p-2 rounded-lg text-xs font-mono"
                    style={{
                      background: isCorrect ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                      border: `1px solid ${isCorrect ? '#16a34a' : '#dc2626'}`,
                      color: isCorrect ? '#16a34a' : '#dc2626',
                    }}
                  >
                    <p className="font-bold mb-0.5">{state.validation.message}</p>
                    {state.validation.explanation && (
                      <p className="opacity-80 leading-relaxed">{state.validation.explanation}</p>
                    )}
                    {isIncorrect && (
                      <button onClick={() => retryStep(step.id)}
                        className="mt-1.5 underline font-bold opacity-80 hover:opacity-100">
                        Try again
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Completion banner */}
      <AnimatePresence>
        {completedAll && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="card p-4 text-center"
            style={{ border: `2px solid ${accentColor}`, background: `color-mix(in srgb, ${accentColor} 6%, var(--surface))` }}
          >
            <p className="text-2xl mb-1">🎉</p>
            <p className="font-bold" style={{ color: accentColor }}>Proof Complete!</p>
            <p className="text-xs text-[var(--ink-3)] font-mono mt-1">
              All {steps.length} steps verified successfully.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Controlled text input that submits on Enter or button click */
function StepInput({
  placeholder,
  accentColor,
  onSubmit,
  inputType,
}: {
  placeholder: string;
  accentColor: string;
  onSubmit: (val: string) => void;
  inputType: 'text' | 'number';
}) {
  const [val, setVal] = useState('');
  return (
    <div className="flex gap-2">
      <input
        type={inputType}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { onSubmit(val.trim()); setVal(''); } }}
        placeholder={placeholder}
        className="code-input-field flex-1"
      />
      <button
        onClick={() => { if (val.trim()) { onSubmit(val.trim()); setVal(''); } }}
        className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
        style={{ color: accentColor, borderColor: accentColor, background: `color-mix(in srgb, ${accentColor} 10%, transparent)` }}
      >
        Submit
      </button>
    </div>
  );
}
