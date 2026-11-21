import { describe, expect, it } from "vitest";
import { errorMessage } from "./errors";
import { LOBBY_STAGE_LABELS, TABLE_STAGE_LABELS } from "./labels";
import { normalizeTableCode, tablePath } from "./table";
import { remainingFraction, secondsRemaining } from "./time";

describe("secondsRemaining", () => {
  it("rounds partial seconds up", () => {
    expect(secondsRemaining(10_500, 0)).toBe(11);
    expect(secondsRemaining(10_000, 0)).toBe(10);
  });

  it("never goes below zero", () => {
    expect(secondsRemaining(1_000, 5_000)).toBe(0);
  });

  it("is null without a deadline", () => {
    expect(secondsRemaining(null, 0)).toBeNull();
  });
});

describe("remainingFraction", () => {
  it("is the share of the turn left", () => {
    expect(remainingFraction(15_000, 0, 30_000)).toBe(0.5);
  });

  it("clamps to 0..1", () => {
    expect(remainingFraction(60_000, 0, 30_000)).toBe(1);
    expect(remainingFraction(0, 5_000, 30_000)).toBe(0);
  });

  it("is null without a deadline", () => {
    expect(remainingFraction(null, 0, 30_000)).toBeNull();
  });
});

describe("table codes", () => {
  it("normalizes typed codes to trimmed upper case", () => {
    expect(normalizeTableCode("  abc12x ")).toBe("ABC12X");
  });

  it("builds the in-app route from a normalized code", () => {
    expect(tablePath(" xyz789")).toBe("/table/XYZ789");
  });
});

describe("errorMessage", () => {
  it("uses an Error's message", () => {
    expect(errorMessage(new Error("Table is full"), "fallback")).toBe("Table is full");
  });

  it.each(["oops", 42, null, { message: "not an Error" }])("falls back for %j", value => {
    expect(errorMessage(value, "fallback")).toBe("fallback");
  });
});

describe("stage labels", () => {
  it("label the same stages in the lobby and on the felt", () => {
    expect(Object.keys(LOBBY_STAGE_LABELS).sort()).toEqual(Object.keys(TABLE_STAGE_LABELS).sort());
  });
});
