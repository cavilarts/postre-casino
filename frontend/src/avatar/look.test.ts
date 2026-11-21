import { describe, expect, it } from "vitest";
import { CHARACTERS } from "./characters";
import {
  ACCENTS,
  composeAvatar,
  DEFAULT_LOOK,
  HAT_NAMES,
  type Look,
  optionCount,
  randomLook,
  sanitizeLook,
  withCharacter,
} from "./look";

describe("sanitizeLook", () => {
  it("keeps a valid look unchanged", () => {
    const look: Look = { character: 5, tone: 3, hair: 2, accent: 1, hat: 1, glasses: true };
    expect(sanitizeLook(look)).toEqual(look);
  });

  it("drops legacy keys but keeps the fields both versions share", () => {
    const legacy = { body: 1, skin: 2, hairColor: 1, hairStyle: 3, outfit: 2, accent: 1, hat: 2, glasses: true };
    expect(sanitizeLook(legacy)).toEqual({ ...DEFAULT_LOOK, accent: 1, hat: 2, glasses: true });
  });

  it("resets out-of-range, fractional, negative and non-numeric indexes", () => {
    const raw = { character: 99, tone: 2.5, hair: -1, accent: "1", hat: HAT_NAMES.length, glasses: "yes" };
    expect(sanitizeLook(raw)).toEqual(DEFAULT_LOOK);
  });

  it.each([null, undefined, "look", 42, []])("falls back to the default look for %j", raw => {
    expect(sanitizeLook(raw)).toEqual(DEFAULT_LOOK);
  });
});

describe("optionCount", () => {
  it("reads tone and hair counts from each character's swatches", () => {
    CHARACTERS.forEach((c, i) => {
      expect(optionCount(i, "tone")).toBe(c.tones.length);
      expect(optionCount(i, "hair")).toBe(c.hairs.length);
    });
  });

  it("uses the shared accent and headwear lists", () => {
    expect(optionCount(0, "accent")).toBe(ACCENTS.length);
    expect(optionCount(0, "hat")).toBe(HAT_NAMES.length);
  });

  it("treats an unknown character as the first one", () => {
    expect(optionCount(99, "tone")).toBe(CHARACTERS[0].tones.length);
  });
});

describe("withCharacter", () => {
  it("switches character and keeps every other choice that still applies", () => {
    const look: Look = { character: 0, tone: 2, hair: 3, accent: 1, hat: 2, glasses: true };
    expect(withCharacter(look, 4)).toEqual({ ...look, character: 4 });
  });

  it("resets tone and hair the new character doesn't offer", () => {
    const look: Look = { ...DEFAULT_LOOK, tone: 50, hair: 50 };
    expect(withCharacter(look, 1)).toMatchObject({ character: 1, tone: 0, hair: 0 });
  });
});

describe("randomLook", () => {
  it("always produces a valid look", () => {
    for (let i = 0; i < 500; i++) {
      const look = randomLook();
      expect(sanitizeLook(look)).toEqual(look);
    }
  });

  it("keeps the requested character", () => {
    for (let i = 0; i < 50; i++) expect(randomLook(3).character).toBe(3);
  });
});

describe("composeAvatar", () => {
  it("renders every character with every headwear, glasses on and off", () => {
    CHARACTERS.forEach((_, character) => {
      HAT_NAMES.forEach((_, hat) => {
        for (const glasses of [false, true]) {
          const layers = composeAvatar({ ...DEFAULT_LOOK, character, hat, glasses });
          expect(layers.length).toBeGreaterThan(0);
          for (const layer of layers) {
            expect(layer.color).toMatch(/^#[0-9a-f]{6}$/i);
            expect(layer.d).not.toBe("");
          }
        }
      });
    });
  });

  it("falls back instead of throwing for indexes outside the lists", () => {
    const layers = composeAvatar({ character: 99, tone: 99, hair: 99, accent: 99, hat: 99, glasses: false });
    expect(layers.length).toBeGreaterThan(0);
  });

  it("caches the layers per look", () => {
    const look: Look = { ...DEFAULT_LOOK, character: 2 };
    expect(composeAvatar({ ...look })).toBe(composeAvatar({ ...look }));
  });

  it("recolours with the chosen tone and accent", () => {
    const colors = (look: Look) => composeAvatar(look).map(l => l.color);
    const cake = CHARACTERS.findIndex(c => c.name === "Cake face");
    const chocolate = colors({ ...DEFAULT_LOOK, character: cake, tone: 2, accent: 1 });
    expect(chocolate).toContain(CHARACTERS[cake].tones[2].colors.F);
    expect(chocolate).toContain(ACCENTS[1].color);
  });
});
