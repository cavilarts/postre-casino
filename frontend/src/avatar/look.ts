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

/** Number of choices for each option; every character has 4 tones and 4 hair swatches. */
export const OPTION_COUNTS = {
  character: CHARACTERS.length,
  tone: 4,
  hair: 4,
  accent: ACCENTS.length,
  hat: HAT_NAMES.length,
} as const;

export const DEFAULT_LOOK: Look = {
  character: 0,
  tone: 0,
  hair: 0,
  accent: 0,
  hat: 0,
  glasses: false,
};

export function randomLook(character?: number): Look {
  const pick = (n: number) => Math.floor(Math.random() * n);
  return {
    character: character ?? pick(OPTION_COUNTS.character),
    tone: pick(OPTION_COUNTS.tone),
    hair: pick(OPTION_COUNTS.hair),
    accent: pick(OPTION_COUNTS.accent),
    hat: pick(OPTION_COUNTS.hat),
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
