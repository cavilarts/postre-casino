import { toLayers, type PixelLayer } from "./sprites";

export type SuitCode = "h" | "d" | "c" | "s";

const W = 24;
const H = 34;

const PALETTE: Record<string, string> = {
  k: "#2b1a10",
  f: "#fbf3d9",
  p: "#e0c890",
  r: "#b3342a",
  b: "#2b2118",
  g: "#f2c96b",
};

/** 3x5 pixel font. */
const GLYPHS: Record<string, string[]> = {
  "0": ["XXX", "X.X", "X.X", "X.X", "XXX"],
  "1": [".X.", "XX.", ".X.", ".X.", "XXX"],
  "2": ["XXX", "..X", "XXX", "X..", "XXX"],
  "3": ["XXX", "..X", "XXX", "..X", "XXX"],
  "4": ["X.X", "X.X", "XXX", "..X", "..X"],
  "5": ["XXX", "X..", "XXX", "..X", "XXX"],
  "6": ["XXX", "X..", "XXX", "X.X", "XXX"],
  "7": ["XXX", "..X", ".X.", ".X.", ".X."],
  "8": ["XXX", "X.X", "XXX", "X.X", "XXX"],
  "9": ["XXX", "X.X", "XXX", "..X", "XXX"],
  A: [".X.", "X.X", "XXX", "X.X", "X.X"],
  J: ["..X", "..X", "..X", "X.X", "XXX"],
  Q: ["XXX", "X.X", "X.X", "XXX", "..X"],
  K: ["X.X", "XX.", "X..", "XX.", "X.X"],
};

/** Suit silhouettes drawn from math, rasterised on a size x size grid. */
function suitBitmap(suit: SuitCode, size: number): string[] {
  const inside = (x: number, y: number): boolean => {
    const heart = (px: number, py: number) => {
      const u = px * 1.15;
      const v = py * 1.15 + 0.1;
      return (u * u + v * v - 1) ** 3 - u * u * v * v * v <= 0;
    };
    const stem = (px: number, py: number, top: number) => Math.abs(px) < 0.14 && py > top && py < 0.92;
    const base = (px: number, py: number) => py > 0.6 && py < 0.92 && Math.abs(px) < (0.92 - py) * 1.2;
    switch (suit) {
      case "h":
        return heart(x, -y);
      case "d":
        return Math.abs(x) + Math.abs(y) <= 0.95;
      case "s":
        return heart(x, y) || stem(x, y, 0.1) || base(x, y);
      case "c": {
        const circle = (cx: number, cy: number) => (x - cx) ** 2 + (y - cy) ** 2 <= 0.2;
        return circle(0, -0.42) || circle(-0.42, 0.12) || circle(0.42, 0.12) || stem(x, y, 0.05) || base(x, y);
      }
    }
  };
  const rows: string[] = [];
  for (let j = 0; j < size; j++) {
    let row = "";
    for (let i = 0; i < size; i++) {
      const x = ((i + 0.5) / size) * 2 - 1;
      const y = ((j + 0.5) / size) * 2 - 1;
      row += inside(x, y) ? "X" : ".";
    }
    rows.push(row);
  }
  return rows;
}

/** Hand-drawn 5x5 corner icons; clearer than a rasterised shape at this size. */
const CORNER_SUITS: Record<SuitCode, string[]> = {
  h: [".X.X.", "XXXXX", "XXXXX", ".XXX.", "..X.."],
  d: ["..X..", ".XXX.", "XXXXX", ".XXX.", "..X.."],
  c: ["..X..", ".XXX.", "XXXXX", "..X..", ".XXX."],
  s: ["..X..", ".XXX.", "XXXXX", "XXXXX", "..X.."],
};

type Grid = string[][];

function blank(ch: string): Grid {
  return Array.from({ length: H }, () => Array<string>(W).fill(ch));
}

function stamp(g: Grid, rows: string[], x0: number, y0: number, ink: string, scale = 1) {
  rows.forEach((row, dy) => {
    [...row].forEach((cell, dx) => {
      if (cell !== "X") return;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const x = x0 + dx * scale + sx;
          const y = y0 + dy * scale + sy;
          if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = ink;
        }
      }
    });
  });
}

function rankRows(rank: string): string[] {
  const glyphs = [...rank].map(ch => GLYPHS[ch] ?? GLYPHS["0"]);
  return [0, 1, 2, 3, 4].map(row => glyphs.map(glyph => glyph[row]).join("."));
}

function rotate(rows: string[]): string[] {
  return [...rows].reverse().map(row => [...row].reverse().join(""));
}

function frame(g: Grid) {
  for (let x = 0; x < W; x++) {
    g[0][x] = "k";
    g[H - 1][x] = "k";
  }
  for (let y = 0; y < H; y++) {
    g[y][0] = "k";
    g[y][W - 1] = "k";
  }
  for (let x = 1; x < W - 1; x++) {
    g[1][x] = "p";
    g[H - 2][x] = "p";
  }
  for (let y = 1; y < H - 1; y++) {
    g[y][1] = "p";
    g[y][W - 2] = "p";
  }
}

function goldFrame(g: Grid, x0: number, y0: number, x1: number, y1: number) {
  for (let x = x0; x <= x1; x++) {
    g[y0][x] = "g";
    g[y1][x] = "g";
  }
  for (let y = y0; y <= y1; y++) {
    g[y][x0] = "g";
    g[y][x1] = "g";
  }
}

export function faceRows(rank: string, suit: SuitCode): string[] {
  const g = blank("f");
  frame(g);

  const ink = suit === "h" || suit === "d" ? "r" : "b";
  const rank_ = rankRows(rank);
  const rankWidth = rank_[0].length;
  const isCourt = rank === "J" || rank === "Q" || rank === "K";

  // top-left corner: rank above suit, kept in the left column
  stamp(g, rank_, 2, 2, ink);
  stamp(g, CORNER_SUITS[suit], 2, 7, ink);

  // bottom-right corner, rotated 180 degrees
  stamp(g, rotate(rank_), W - 2 - rankWidth, H - 2 - 6, ink);
  stamp(g, rotate(CORNER_SUITS[suit]), W - 2 - 5, H - 2 - 11, ink);

  if (isCourt) {
    goldFrame(g, 7, 11, W - 8, H - 12);
    stamp(g, GLYPHS[rank], 9, 13, ink, 2);
  } else {
    stamp(g, suitBitmap(suit, 11), 6, 12, ink);
  }

  return g.map(row => row.join(""));
}

const cache = new Map<string, PixelLayer[]>();

/** Vector layers for a card face, e.g. "Ah" or "Td". Cached per card. */
export function faceLayers(code: string): PixelLayer[] {
  let layers = cache.get(code);
  if (!layers) {
    const rank = code[0] === "T" ? "10" : code[0];
    const suit = code[1] as SuitCode;
    layers = toLayers(faceRows(rank, suit), PALETTE);
    cache.set(code, layers);
  }
  return layers;
}
