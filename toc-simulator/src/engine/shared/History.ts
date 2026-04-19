// Time-Travel History Manager
// Stores snapshots of computation states and allows seeking to any step

export interface HistorySnapshot<T> {
  stepNum: number;
  data: T;
  label: string;         // Human-readable description
  timestamp: number;     // relative ms from start of simulation
}

export class HistoryManager<T> {
  private snapshots: HistorySnapshot<T>[] = [];
  private cursorPos = -1;
  private readonly maxSize: number;

  constructor(maxSize = 2000) {
    this.maxSize = maxSize;
  }

  /** Push a new snapshot */
  push(data: T, label: string): void {
    // Truncate forward history if we're mid-history
    if (this.cursorPos < this.snapshots.length - 1) {
      this.snapshots = this.snapshots.slice(0, this.cursorPos + 1);
    }
    if (this.snapshots.length >= this.maxSize) {
      this.snapshots.shift();
    }
    this.snapshots.push({
      stepNum: this.snapshots.length,
      data,
      label,
      timestamp: Date.now(),
    });
    this.cursorPos = this.snapshots.length - 1;
  }

  /** Load all snapshots at once (from engine trace) */
  loadAll(snapshots: Array<{ data: T; label: string }>): void {
    this.snapshots = snapshots.map((s, i) => ({
      stepNum: i,
      data: s.data,
      label: s.label,
      timestamp: i * 100,
    }));
    this.cursorPos = this.snapshots.length > 0 ? 0 : -1;
  }

  /** Seek to a specific step index */
  seekTo(index: number): HistorySnapshot<T> | null {
    if (index < 0 || index >= this.snapshots.length) return null;
    this.cursorPos = index;
    return this.snapshots[index];
  }

  /** Move one step forward */
  forward(): HistorySnapshot<T> | null {
    return this.seekTo(this.cursorPos + 1);
  }

  /** Move one step backward */
  back(): HistorySnapshot<T> | null {
    return this.seekTo(this.cursorPos - 1);
  }

  /** Jump to first step */
  first(): HistorySnapshot<T> | null {
    return this.seekTo(0);
  }

  /** Jump to last step */
  last(): HistorySnapshot<T> | null {
    return this.seekTo(this.snapshots.length - 1);
  }

  /** Current snapshot */
  current(): HistorySnapshot<T> | null {
    return this.snapshots[this.cursorPos] ?? null;
  }

  /** All snapshots (read-only) */
  all(): readonly HistorySnapshot<T>[] {
    return this.snapshots;
  }

  get length(): number { return this.snapshots.length; }
  get cursor(): number { return this.cursorPos; }
  get canGoBack(): boolean { return this.cursorPos > 0; }
  get canGoForward(): boolean { return this.cursorPos < this.snapshots.length - 1; }

  reset(): void {
    this.snapshots = [];
    this.cursorPos = -1;
  }
}

// React hook helper for using HistoryManager with useState
export function buildHistoryFromSteps<S, T>(
  steps: S[],
  mapper: (step: S, index: number) => { data: T; label: string }
): Array<{ data: T; label: string }> {
  return steps.map((step, i) => mapper(step, i));
}
