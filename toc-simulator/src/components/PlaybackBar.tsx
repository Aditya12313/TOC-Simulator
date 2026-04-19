import { motion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, ChevronRight, ChevronLeft } from 'lucide-react';

interface PlaybackBarProps {
  currentStep: number;
  totalSteps: number;
  isRunning: boolean;
  speed: number; // 1=slow, 2=normal, 3=fast
  onPrev: () => void;
  onNext: () => void;
  onFirst: () => void;
  onLast: () => void;
  onTogglePlay: () => void;
  onSpeedChange: (s: number) => void;
  accentClass?: string; // e.g. 'btn-cfg'
  accentColor?: string; // e.g. 'var(--cfg)'
}

const SPEEDS = [
  { label: '0.5×', value: 1 },
  { label: '1×',   value: 2 },
  { label: '2×',   value: 3 },
];

export default function PlaybackBar({
  currentStep, totalSteps, isRunning,
  speed, onPrev, onNext, onFirst, onLast, onTogglePlay, onSpeedChange,
  accentClass = 'btn-ink', accentColor = 'var(--ink)',
}: PlaybackBarProps) {
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;
  const atStart = currentStep <= 0;
  const atEnd   = currentStep >= totalSteps - 1;

  return (
    <div className="border-t border-[var(--border)] px-4 py-2.5 flex items-center gap-3"
      style={{ background: 'var(--surface)' }}>

      {/* Step counter */}
      <span className="font-mono text-xs text-[var(--ink-3)] shrink-0 w-20">
        {totalSteps > 0 ? `${currentStep + 1} / ${totalSteps}` : '— / —'}
      </span>

      {/* Controls */}
      <div className="flex items-center gap-1">
        <motion.button whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }} transition={{ duration: 0.16, ease: 'easeOut' }}
          onClick={onFirst} disabled={atStart || totalSteps === 0}
          className="btn-outline btn-sm" title="Go to start">
          <SkipBack size={12} />
        </motion.button>
        <motion.button whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }} transition={{ duration: 0.16, ease: 'easeOut' }}
          onClick={onPrev} disabled={atStart || totalSteps === 0}
          className="btn-outline btn-sm" title="Previous step">
          <ChevronLeft size={12} /> Prev
        </motion.button>

        {/* Play/Pause — accent colored */}
        <motion.button
          whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }} transition={{ duration: 0.16, ease: 'easeOut' }}
          onClick={onTogglePlay} disabled={totalSteps === 0}
          className={`${accentClass} btn-sm px-4`}
          title={isRunning ? 'Pause' : 'Auto-run'}
        >
          {isRunning ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Run</>}
        </motion.button>

        <motion.button whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }} transition={{ duration: 0.16, ease: 'easeOut' }}
          onClick={onNext} disabled={atEnd || totalSteps === 0}
          className="btn-outline btn-sm" title="Next step">
          Next <ChevronRight size={12} />
        </motion.button>
        <motion.button whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }} transition={{ duration: 0.16, ease: 'easeOut' }}
          onClick={onLast} disabled={atEnd || totalSteps === 0}
          className="btn-outline btn-sm" title="Go to end">
          <SkipForward size={12} />
        </motion.button>
      </div>

      {/* Progress bar */}
      <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-2)] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: accentColor }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        />
      </div>

      {/* Speed */}
      <div className="flex items-center gap-0.5 shrink-0">
        {SPEEDS.map(s => (
          <button
            key={s.value}
            onClick={() => onSpeedChange(s.value)}
            className={`px-2 py-1 text-xs font-mono rounded-md border transition-all duration-100 ${
              speed === s.value
                ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                : 'border-[var(--border)] text-[var(--ink-3)] hover:border-[var(--ink-3)]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
