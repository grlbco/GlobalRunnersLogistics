export type Daily = { day: string; replies: number; answered: number; forms: number; applied: number };

/** Sum of the last `n` days vs the `n` days before: the delta shown on KPI cards. */
export function windowDelta(values: number[], n = 7) {
  const now = values.slice(-n).reduce((s, v) => s + v, 0);
  const before = values.slice(-2 * n, -n).reduce((s, v) => s + v, 0);
  return { now, before, diff: now - before };
}
