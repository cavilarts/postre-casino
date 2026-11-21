/// <reference types="node" />
// The server validates looks and dresses bots with counts copied from the
// client's lists (backend/src/protocol.rs). These tests fail if they drift.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHARACTERS } from "./characters";
import { ACCENTS, HAT_NAMES } from "./look";

const protocol = readFileSync(new URL("../../../backend/src/protocol.rs", import.meta.url), "utf8");

function serverConstant(name: string): number {
  const match = protocol.match(new RegExp(`const ${name}: u8 = (\\d+);`));
  if (!match) throw new Error(`Look::${name} not found in protocol.rs`);
  return Number(match[1]);
}

describe("server Look constants match the client lists", () => {
  it("CHARACTER_COUNT is the number of characters", () => {
    expect(serverConstant("CHARACTER_COUNT")).toBe(CHARACTERS.length);
  });

  it("ACCENT_COUNT is the number of accent colours", () => {
    expect(serverConstant("ACCENT_COUNT")).toBe(ACCENTS.length);
  });

  it("HAT_COUNT is the number of headwear options", () => {
    expect(serverConstant("HAT_COUNT")).toBe(HAT_NAMES.length);
  });

  it("MIN_SWATCHES is offered by every character, so bots always pick a real swatch", () => {
    const min = serverConstant("MIN_SWATCHES");
    for (const c of CHARACTERS) {
      expect(c.tones.length).toBeGreaterThanOrEqual(min);
      expect(c.hairs.length).toBeGreaterThanOrEqual(min);
    }
  });
});
