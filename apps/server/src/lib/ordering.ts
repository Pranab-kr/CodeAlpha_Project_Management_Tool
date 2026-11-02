export const APPEND_GAP = 1024;
export const MIN_GAP = 1e-6;

/** Position for a new last item: `max + 1024`, or `1024` for an empty list. */
export function appendPosition(max: number | null): number {
  return max === null ? APPEND_GAP : max + APPEND_GAP;
}

/**
 * Midpoint between two neighbours. At least one neighbour is required; both
 * null means "append" and is handled by the service, not here.
 */
export function computePosition(
  before: number | null,
  after: number | null,
): number {
  if (before === null && after === null) {
    throw new Error("computePosition requires at least one neighbour");
  }
  if (before === null) {
    // Non-null assertion avoided: the branch guarantees after is a number.
    return (after as number) - APPEND_GAP;
  }
  if (after === null) {
    return before + APPEND_GAP;
  }
  return (before + after) / 2;
}

/** True when two neighbours are so close that the midpoint could collide. */
export function needsRenumber(
  before: number | null,
  after: number | null,
): boolean {
  return before !== null && after !== null && after - before < 2 * MIN_GAP;
}

/** Fresh positions for a renumbered list: 1024, 2048, 3072, … */
export function renumberedPositions(count: number): number[] {
  return Array.from({ length: count }, (_, index) => (index + 1) * APPEND_GAP);
}
