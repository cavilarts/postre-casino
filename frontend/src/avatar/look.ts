import { toLayers, type PixelLayer } from "../pixel/sprites";
import { CHARACTERS, shift } from "./characters";
import { HATS } from "./parts";

/**
 * A player's appearance. Every character offers the same options; `tone` and
 * `hair` index that character's own swatches (skin / flavour / fur, and hair /
 * frosting / tail / stripes).
 */
export interface Look {
  character: number;
  tone: number;
  hair: number;
  accent: number;
  hat: number;
  glasses: boolean;
}

export interface Option {
  name: string;
  color: string;
}

export const ACCENTS: Option[] = [
  { name: "Ruby", color: "#b03a2e" },
  { name: "Sapphire", color: "#3d6f9e" },
  { name: "Clover", color: "#4d7f35" },
  { name: "Plum", color: "#7a2a6e" },
];

export const HAT_NAMES = ["None", "Top hat", "Cap", "Crown"];

export type SteppedOption = "tone" | "hair" | "accent" | "hat";

/**
 * Number of choices for an option, derived from the data itself. Tone and hair
 * come from the given character's swatch lists, so characters may offer
 * different numbers of swatches.
 */
export function optionCount(character: number, option: SteppedOption): number {
  const c = CHARACTERS[character] ?? CHARACTERS[0];
  switch (option) {
    case "tone":
      return c.tones.length;
    case "hair":
      return c.hairs.length;
    case "accent":
      return ACCENTS.length;
    case "hat":
      return HAT_NAMES.length;
  }
}

/** Switches character, keeping tone/hair choices that the new character also offers. */
export function withCharacter(look: Look, character: number): Look {
  return {
    ...look,
    character,
    tone: look.tone < optionCount(character, "tone") ? look.tone : 0,
    hair: look.hair < optionCount(character, "hair") ? look.hair : 0,
  };
}

export const DEFAULT_LOOK: Look = {
  character: 0,
  tone: 0,
  hair: 0,
  accent: 0,
  hat: 0,
  glasses: false,
};

/**
 * Builds a valid Look from untrusted data (e.g. localStorage): keeps only the
 * known fields, and resets any index that is not a whole number in range.
 * Legacy keys from the old part-by-part creator are dropped.
 */
export function sanitizeLook(raw: unknown): Look {
  const r = (raw !== null && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const index = (value: unknown, count: number) =>
    typeof value === "number" && Number.isInteger(value) && value >= 0 && value < count ? value : 0;
  const character = index(r.character, CHARACTERS.length);
  return {
    character,
    tone: index(r.tone, optionCount(character, "tone")),
    hair: index(r.hair, optionCount(character, "hair")),
    accent: index(r.accent, optionCount(character, "accent")),
    hat: index(r.hat, optionCount(character, "hat")),
    glasses: r.glasses === true,
  };
}

export function randomLook(character?: number): Look {
  const pick = (n: number) => Math.floor(Math.random() * n);
  const chosen = character ?? pick(CHARACTERS.length);
  return {
    character: chosen,
    tone: pick(optionCount(chosen, "tone")),
    hair: pick(optionCount(chosen, "hair")),
    accent: pick(optionCount(chosen, "accent")),
    hat: pick(optionCount(chosen, "hat")),
    glasses: Math.random() < 0.3,
  };
}

const OUTLINE = "#2b1a10";

function overlay(canvas: string[][], part: string[] | null | undefined) {
  if (!part) return;
  part.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== ".") canvas[y][x] = ch;
    });
  });
}

const cache = new Map<string, PixelLayer[]>();

/** Builds the 16x16 pixel avatar for a look, as vector layers. */
export function composeAvatar(look: Look): PixelLayer[] {
  const key = JSON.stringify(look);
  const hit = cache.get(key);
  if (hit) return hit;

  const character = CHARACTERS[look.character] ?? CHARACTERS[0];
  const canvas = Array.from({ length: 16 }, () => Array<string>(16).fill("."));
  character.layers.forEach(layer => overlay(canvas, layer));
  const hat = HATS[look.hat];
  if (hat) overlay(canvas, shift(hat, ...character.hatOffset));
  else character.bare?.forEach(layer => overlay(canvas, layer));
  if (look.glasses) overlay(canvas, character.glasses);

  const palette: Record<string, string> = {
    K: OUTLINE,
    E: OUTLINE,
    G: OUTLINE,
    M: "#8a4f3a",
    W: "#f7f2e6",
    B: "#2b2118",
    A: (ACCENTS[look.accent] ?? ACCENTS[0]).color,
    T: "#1e1e24",
    Y: "#f2c96b",
    L: "#bfe3e8",
    P: "#c4576b",
    ...(character.tones[look.tone] ?? character.tones[0]).colors,
    ...(character.hairs[look.hair] ?? character.hairs[0]).colors,
  };
  const layers = toLayers(
    canvas.map(row => row.join("")),
    palette,
  );
  cache.set(key, layers);
  return layers;
}
