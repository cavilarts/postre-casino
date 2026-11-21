import { describe, expect, it } from "vitest";
import { faceLayers, faceRows, type SuitCode } from "./cardface";

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const SUITS: SuitCode[] = ["h", "d", "c", "s"];

describe("faceRows", () => {
  it("draws every card on the same rectangular grid", () => {
    const [first] = faceRows("A", "s");
    const height = faceRows("A", "s").length;
    for (const rank of RANKS) {
      for (const suit of SUITS) {
        const rows = faceRows(rank, suit);
        expect(rows).toHaveLength(height);
        for (const row of rows) expect(row).toHaveLength(first.length);
      }
    }
  });

  it("inks hearts and diamonds red, clubs and spades black", () => {
    const inks = (suit: SuitCode) => new Set(faceRows("7", suit).join("").replace(/[^rb]/g, ""));
    expect(inks("h")).toEqual(new Set(["r"]));
    expect(inks("d")).toEqual(new Set(["r"]));
    expect(inks("c")).toEqual(new Set(["b"]));
    expect(inks("s")).toEqual(new Set(["b"]));
  });

  it("draws different art for every rank", () => {
    const faces = RANKS.map(rank => faceRows(rank, "s").join("\n"));
    expect(new Set(faces).size).toBe(RANKS.length);
  });
});

describe("faceLayers", () => {
  it("reads 'T' as a ten", () => {
    expect(faceLayers("Th")).toEqual(faceLayers("Th"));
    const ten = faceLayers("Td").map(l => l.d).join();
    const nine = faceLayers("9d").map(l => l.d).join();
    expect(ten).not.toBe(nine);
  });

  it("caches the layers per card", () => {
    expect(faceLayers("As")).toBe(faceLayers("As"));
  });
});
