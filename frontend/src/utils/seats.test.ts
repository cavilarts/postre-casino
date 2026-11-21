import { describe, expect, it } from "vitest";
import { centeredSeatAngle, seatPosition } from "./seats";

const point = (seat: number, count: number, you: number | null) => {
  const { left, top } = seatPosition(seat, count, you);
  return { x: parseFloat(left), y: parseFloat(top) };
};

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9];

describe("seatPosition", () => {
  it("puts a seated viewer at the bottom centre, whatever their seat number", () => {
    for (const count of TABLE_SIZES) {
      for (let you = 0; you < count; you++) {
        const p = point(you, count, you);
        expect(p.x).toBeCloseTo(50);
        expect(p.y).toBeCloseTo(94);
      }
    }
  });

  it.each(TABLE_SIZES)("gives every seat its own spot on the oval (%i seats)", count => {
    for (const you of [null, 0, count - 1]) {
      const spots = Array.from({ length: count }, (_, seat) => point(seat, count, you));
      const keys = spots.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`);
      expect(new Set(keys).size).toBe(count);
      for (const p of spots) {
        expect(p.x).toBeGreaterThanOrEqual(10);
        expect(p.x).toBeLessThanOrEqual(90);
        expect(p.y).toBeGreaterThanOrEqual(6);
        expect(p.y).toBeLessThanOrEqual(94);
      }
    }
  });

  it("seats the lone opponent on the right in a heads-up game", () => {
    const p = point(1, 2, 0);
    expect(p.x).toBeCloseTo(90);
    expect(p.y).toBeCloseTo(50);
  });
});

describe("centeredSeatAngle", () => {
  const TOP_GAP = Math.PI / 6;

  it.each(TABLE_SIZES.filter(n => n > 2))("keeps opponents out of the dealer's gap at the top (%i seats)", count => {
    for (let rel = 1; rel < count; rel++) {
      const angle = centeredSeatAngle(rel, count) % (2 * Math.PI);
      const fromTop = Math.min(angle, 2 * Math.PI - angle);
      expect(fromTop).toBeGreaterThanOrEqual(TOP_GAP - 1e-9);
    }
  });

  it.each(TABLE_SIZES.filter(n => n > 2))("goes clockwise in equal steps (%i seats)", count => {
    const angles = Array.from({ length: count - 1 }, (_, i) => centeredSeatAngle(i + 1, count));
    for (let i = 1; i < angles.length; i++) expect(angles[i]).toBeGreaterThan(angles[i - 1]);
  });
});
