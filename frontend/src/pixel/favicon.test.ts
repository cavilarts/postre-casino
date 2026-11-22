/// <reference types="node" />
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ICON, toSvg } from "./favicon";
import { LOGO } from "./logo";

const FAVICON = new URL("../../public/favicon.svg", import.meta.url);

describe("pixel logo", () => {
  it("keeps the header logo at 57x15", () => {
    expect([LOGO.width, LOGO.height]).toEqual([57, 15]);
  });

  it("draws the icon on a 32x32 grid", () => {
    expect([ICON.width, ICON.height]).toEqual([32, 32]);
  });

  it("keeps public/favicon.svg in sync with ICON", () => {
    const expected = toSvg(ICON);
    if (process.env.UPDATE_FAVICON) writeFileSync(FAVICON, expected);
    expect(readFileSync(FAVICON, "utf8"), "favicon.svg is stale: run `npm run favicon`").toBe(expected);
  });
});
