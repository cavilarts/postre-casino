import { toLayers, type PixelLayer } from "./sprites";

export interface PixelArt {
  width: number;
  height: number;
  layers: PixelLayer[];
}

type Suit = "s" | "h" | "d" | "c";

// 11x11 suits drawn for the logo ('X' fill, 'o' highlight, '.' transparent).
const SUITS: Record<Suit, string[]> = {
  s: [
    ".....X.....",
    "....XXX....",
    "...XXXXX...",
    "..XXXXXXX..",
    ".XoXXXXXXX.",
    "XoXXXXXXXXX",
    "XXXXXXXXXXX",
    ".XXX.X.XXX.",
    ".....X.....",
    "....XXX....",
    "...XXXXX...",
  ],
  h: [
    "...........",
    ".XXX...XXX.",
    "XoXXX.XXXXX",
    "XoXXXXXXXXX",
    "XXXXXXXXXXX",
    "XXXXXXXXXXX",
    ".XXXXXXXXX.",
    "..XXXXXXX..",
    "...XXXXX...",
    "....XXX....",
    ".....X.....",
  ],
  d: [
    ".....X.....",
    "....XXX....",
    "...XXXXX...",
    "..XoXXXXX..",
    ".XoXXXXXXX.",
    "XXXXXXXXXXX",
    ".XXXXXXXXX.",
    "..XXXXXXX..",
    "...XXXXX...",
    "....XXX....",
    ".....X.....",
  ],
  c: [
    "....XXX....",
    "...XoXXX...",
    "...XXXXX...",
    ".XX.XXX.XX.",
    "XoXXXXXXXXX",
    "XXXXXXXXXXX",
    ".XXX.X.XXX.",
    ".....X.....",
    "....XXX....",
    "...XXXXX...",
    "...........",
  ],
};

const CELL = 11;
const ORDER: Suit[] = ["s", "h", "d", "c"];
const RED: Record<Suit, boolean> = { s: false, h: true, d: true, c: false };

const PALETTE: Record<string, string> = {
  K: "#2b1a10", // border
  b: "#f7edd0", // tile
  k: "#2b1a10", // black suit
  g: "#6a5340", // black suit highlight
  r: "#c44a34", // red suit
  p: "#ec8a70", // red suit highlight
};

/**
 * Draws the four suits on a bordered cream tile, `perRow` suits per row.
 * `edge` is the 1px border plus padding; `gap` is the space between suits.
 */
export function suitTile(perRow: number, edge: number, gap: number): PixelArt {
  const rows = Math.ceil(ORDER.length / perRow);
  const width = edge * 2 + perRow * CELL + (perRow - 1) * gap;
  const height = edge * 2 + rows * CELL + (rows - 1) * gap;
  const grid: string[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => (x === 0 || y === 0 || x === width - 1 || y === height - 1 ? "K" : "b")),
  );
  ORDER.forEach((suit, i) => {
    const ox = edge + (i % perRow) * (CELL + gap);
    const oy = edge + Math.floor(i / perRow) * (CELL + gap);
    SUITS[suit].forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === "X") grid[oy + y][ox + x] = RED[suit] ? "r" : "k";
        else if (ch === "o") grid[oy + y][ox + x] = RED[suit] ? "p" : "g";
      });
    });
  });
  return { width, height, layers: toLayers(grid.map(row => row.join("")), PALETTE) };
}

/** Header logo: ♠ ♥ ♦ ♣ side by side, 57x15. Render at a multiple of its height for even pixels. */
export const LOGO: PixelArt = suitTile(4, 2, 3);
