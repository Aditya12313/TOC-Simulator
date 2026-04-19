import { RotateCcw } from 'lucide-react';

type ExecutionStatus = 'Idle' | 'Running' | 'Accepted' | 'Rejected' | 'Halted' | 'Loop Detected';

interface ExecutionControlBarProps {
  accent: 'cfg' | 'pda' | 'tm';
  status: ExecutionStatus;
  runLabel?: string;
  stepIndicator: string;
  speed: number;
  speeds: Array<{ label: string; value: number }>;
  onRun: () => void;
  onStep: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  runDisabled?: boolean;
  stepDisabled?: boolean;
  pauseDisabled?: boolean;
  resetDisabled?: boolean;
}

function statusToPill(status: ExecutionStatus): string {
  if (status === 'Running') return 'pill-pda';
  if (status === 'Accepted') return 'pill-cfg';
  if (status === 'Rejected') return 'pill-tm';
  if (status === 'Halted' || status === 'Loop Detected') return 'pill-gray';
  return 'pill-gray';
}

function accentToBtn(accent: 'cfg' | 'pda' | 'tm'): string {
  if (accent === 'cfg') return 'btn-cfg';
  if (accent === 'pda') return 'btn-pda';
  return 'btn-tm';
}

export default function ExecutionControlBar({
  accent,
  status,
  runLabel = 'Run',
  stepIndicator,
  speed,
  speeds,
  onRun,
  onStep,
  onPause,
  onReset,
  onSpeedChange,
  runDisabled = false,
  stepDisabled = false,
  pauseDisabled = false,
  resetDisabled = false,
}: ExecutionControlBarProps) {
  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[min(980px,calc(100%-1.5rem))] px-1">
      <div
        className="rounded-xl border px-4 py-3 flex flex-wrap items-center justify-center lg:justify-between gap-3"
        style={{
          background: 'color-mix(in srgb, var(--surface) 94%, transparent)',
          borderColor: 'var(--border)',
          boxShadow: '0 10px 26px rgba(18, 22, 28, 0.14)',
          backdropFilter: 'blur(6px)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className={`pill ${statusToPill(status)}`}>{status}</span>
          <span className="font-mono text-xs text-[var(--ink-3)]">{stepIndicator}</span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onRun} disabled={runDisabled} className={`${accentToBtn(accent)} btn-sm px-4`}>
            {runLabel}
          </button>
          <button onClick={onStep} disabled={stepDisabled} className="btn-outline btn-sm">
            Step
          </button>
          <button onClick={onPause} disabled={pauseDisabled} className="btn-outline btn-sm">
            Pause
          </button>
          <button onClick={onReset} disabled={resetDisabled} className="btn-outline btn-sm">
            <RotateCcw size={12} />
            Reset
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {speeds.map((option) => (
            <button
              key={option.value}
              onClick={() => onSpeedChange(option.value)}
              className={`px-2 py-1 text-xs font-mono rounded-md border transition-all duration-100 ${
                speed === option.value
                  ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                  : 'border-[var(--border)] text-[var(--ink-3)] hover:border-[var(--ink-3)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
