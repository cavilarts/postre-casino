import { describe, expect, it } from "vitest";
import { CHARACTERS, shift } from "./characters";
import { HATS } from "./parts";

const EMPTY_ROW = ".".repeat(16);
const inked = (grid: string[]) => grid.join("").replace(/\./g, "").length;
const is16x16 = (grid: string[]) => grid.length === 16 && grid.every(row => row.length === 16);

describe("shift", () => {
  const dot = ["X" + ".".repeat(15), ...Array<string>(15).fill(EMPTY_ROW)];

  it("moves pixels right and down", () => {
    const out = shift(dot, 2, 3);
    expect(out[3][2]).toBe("X");
    expect(inked(out)).toBe(1);
  });

  it("clips pixels moved past any edge", () => {
    expect(inked(shift(dot, -1, 0))).toBe(0);
    expect(inked(shift(dot, 0, -1))).toBe(0);
    expect(inked(shift(dot, 16, 0))).toBe(0);
    expect(inked(shift(dot, 0, 16))).toBe(0);
  });

  it("always returns a 16x16 grid", () => {
    expect(is16x16(shift(dot, 5, -7))).toBe(true);
  });
});

describe.each(CHARACTERS.map(c => [c.name, c] as const))("%s", (_name, character) => {
  it("draws every layer, bare layer and glasses grid at 16x16", () => {
    for (const grid of [...character.layers, ...(character.bare ?? []), character.glasses]) {
      expect(is16x16(grid)).toBe(true);
    }
  });

  it("offers at least four tones and four hair swatches", () => {
    expect(character.tones.length).toBeGreaterThanOrEqual(4);
    expect(character.hairs.length).toBeGreaterThanOrEqual(4);
  });

  it("names every swatch", () => {
    for (const swatch of [...character.tones, ...character.hairs]) {
      expect(swatch.name).not.toBe("");
      expect(Object.keys(swatch.colors).length).toBeGreaterThan(0);
    }
  });

  it("keeps every headwear inside the grid", () => {
    for (const hat of HATS) {
      if (hat) expect(inked(shift(hat, ...character.hatOffset))).toBe(inked(hat));
    }
  });
});

it("gives every character a unique name", () => {
  const names = CHARACTERS.map(c => c.name);
  expect(new Set(names).size).toBe(names.length);
});
