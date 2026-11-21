/** Whole seconds left until a deadline, never negative. */
export function secondsRemaining(deadline: number | null, now: number): number | null {
  if (deadline === null) return null;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** Share of a turn timer still left, clamped to 0..1. */
export function remainingFraction(deadline: number | null, now: number, durationMs: number): number | null {
  if (deadline === null) return null;
  return Math.min(1, Math.max(0, (deadline - now) / durationMs));
}
