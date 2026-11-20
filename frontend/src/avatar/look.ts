import { toLayers, type PixelLayer } from "../pixel/sprites";
import { GLASSES, HAIR, HATS, HEAD, HEAD_FEMALE, OUTFITS } from "./parts";

export interface Look {
  body: number;
  skin: number;
  hairColor: number;
  hairStyle: number;
  outfit: number;
  accent: number;
  hat: number;
  glasses: boolean;
}

export interface Option {
  name: string;
  color: string;
}

export const BODIES = ["Male", "Female"];

export const SKINS: Option[] = [
  { name: "Fair", color: "#f0c49a" },
  { name: "Golden", color: "#d9a071" },
  { name: "Tan", color: "#a86f4a" },
  { name: "Deep", color: "#6b4226" },
];

export const HAIR_COLORS: Option[] = [
  { name: "Chestnut", color: "#6b4423" },
  { name: "Jet", color: "#2a2a33" },
  { name: "Ginger", color: "#c9872e" },
  { name: "Silver", color: "#9a9a9a" },
];

export const HAIR_STYLES = ["Short", "Long", "Bun", "Spiky"];
export const OUTFIT_NAMES = ["Tuxedo", "Hoodie", "Vest", "Scarf"];
export const HAT_NAMES = ["None", "Top hat", "Cap", "Crown"];

export const ACCENTS: Option[] = [
  { name: "Ruby", color: "#b03a2e" },
  { name: "Sapphire", color: "#3d6f9e" },
  { name: "Clover", color: "#4d7f35" },
  { name: "Plum", color: "#7a2a6e" },
];

export const DEFAULT_LOOK: Look = {
  body: 0,
  skin: 0,
  hairColor: 0,
  hairStyle: 0,
  outfit: 0,
  accent: 0,
  hat: 0,
  glasses: false,
};

export function randomLook(): Look {
  const pick = (n: number) => Math.floor(Math.random() * n);
  return {
    body: pick(2),
    skin: pick(4),
    hairColor: pick(4),
    hairStyle: pick(4),
    outfit: pick(4),
    accent: pick(4),
    hat: pick(4),
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

  const canvas = Array.from({ length: 16 }, () => Array<string>(16).fill("."));
  overlay(canvas, OUTFITS[look.outfit]);
  overlay(canvas, look.body === 1 ? HEAD_FEMALE : HEAD);
  overlay(canvas, HAIR[look.hairStyle]);
  overlay(canvas, HATS[look.hat]);
  if (look.glasses) overlay(canvas, GLASSES);

  const palette: Record<string, string> = {
    K: OUTLINE,
    E: OUTLINE,
    G: OUTLINE,
    M: "#8a4f3a",
    S: SKINS[look.skin].color,
    H: HAIR_COLORS[look.hairColor].color,
    W: "#f7f2e6",
    B: "#2b2118",
    A: ACCENTS[look.accent].color,
    T: "#1e1e24",
    Y: "#f2c96b",
    L: "#bfe3e8",
    P: "#c4576b",
  };
  const layers = toLayers(canvas.map(row => row.join("")), palette);
  cache.set(key, layers);
  return layers;
}
