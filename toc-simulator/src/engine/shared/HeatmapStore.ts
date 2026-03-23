// Heatmap Store — tracks visit frequencies for states/nodes
// Provides normalized 0–1 heat values for visual overlays

export class HeatmapStore {
  private counts = new Map<string, number>();
  private _maxCount = 0;

  /** Record a visit to a node/state key */
  visit(key: string): void {
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    if (count > this._maxCount) this._maxCount = count;
  }

  /** Record visits for a sequence of keys */
  visitAll(keys: string[]): void {
    for (const k of keys) this.visit(k);
  }

  /** Get normalized heat value (0=cold, 1=hot) */
  heat(key: string): number {
    if (this._maxCount === 0) return 0;
    return (this.counts.get(key) ?? 0) / this._maxCount;
  }

  /** Get raw visit count */
  count(key: string): number {
    return this.counts.get(key) ?? 0;
  }

  /** All tracked keys sorted by heat (descending) */
  hotspots(): Array<{ key: string; count: number; heat: number }> {
    return [...this.counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        count,
        heat: count / this._maxCount,
      }));
  }

  get maxCount(): number { return this._maxCount; }

  /** Get a CSS color (blue→orange→red gradient) for a heat value */
  static heatColor(heat: number): string {
    // 0 → cool blue, 0.5 → yellow, 1 → hot red
    const r = Math.round(heat < 0.5 ? heat * 2 * 255 : 255);
    const g = Math.round(heat < 0.5 ? 180 : (1 - heat) * 2 * 255);
    const b = Math.round(heat < 0.5 ? 255 : 0);
    return `rgba(${r},${g},${b},0.55)`;
  }

  /** Get opacity-only alpha for subtle overlays */
  static heatAlpha(heat: number): number {
    return 0.1 + heat * 0.7;
  }

  reset(): void {
    this.counts.clear();
    this._maxCount = 0;
  }
}
