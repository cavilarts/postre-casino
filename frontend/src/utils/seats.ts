// Seat placement around the oval table, as percentages of the felt.

/** Seats surround an oval on the outside; the croupier stays behind the far rail. */
export function seatPosition(seat: number, count: number, you: number | null) {
  const base = you ?? 0;
  const rel = (seat - base + count) % count;
  const slots = count + 1;
  const bottom = Math.floor(slots / 2);
  const slot = ((bottom - 1 + rel) % count) + 1;
  const angle =
    you !== null
      ? centeredSeatAngle(rel, count)
      : (2 * Math.PI * slot) / slots;
  const radiusX = 40;
  const radiusY = 44;
  const x = 50 + radiusX * Math.sin(angle);
  const y = 50 - radiusY * Math.cos(angle);
  return { left: `${x}%`, top: `${y}%` };
}

/**
 * With a seated viewer: bottom-center for them, then remaining seats in equal
 * clockwise steps along the side arcs, skipping both the viewer and the dealer.
 */
export function centeredSeatAngle(rel: number, count: number): number {
  if (rel === 0) return Math.PI;
  if (count === 2) return Math.PI / 2;

  const gap = Math.PI / 6;
  const arc = Math.PI - 2 * gap;
  const step = (2 * arc) / count;
  const distance = rel * step;
  return distance <= arc ? Math.PI + gap + distance : 2 * Math.PI + gap + distance - arc;
}
