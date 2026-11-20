export interface PixelLayer {
  color: string;
  d: string;
}

/**
 * Converts a grid of characters into one SVG path per colour. Each character
 * maps to a colour in `palette`; '.' is transparent. Rendered with
 * shape-rendering="crispEdges" so every pixel stays sharp at any scale.
 */
export function toLayers(rows: string[], palette: Record<string, string>): PixelLayer[] {
  const byColor = new Map<string, string>();
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = palette[ch];
      if (!color) return;
      byColor.set(color, (byColor.get(color) ?? "") + `M${x} ${y}h1v1h-1z`);
    });
  });
  return [...byColor].map(([color, d]) => ({ color, d }));
}

export const CROUPIER_PALETTE: Record<string, string> = {
  k: "#2b1a10",
  e: "#2b1a10",
  h: "#6b4423",
  s: "#f0c49a",
  c: "#e8977f",
  w: "#f7f2e6",
  r: "#b03a2e",
  b: "#1e1e24",
  d: "#7c2320",
  p: "#3d4f66",
};

export const CROUPIER_BODY = [
  "....kkkkkkkk....",
  "...khhhhhhhhk...",
  "..khhhhhhhhhhk..",
  "..khhhhsshhhhk..",
  "..kssessssessk..",
  "..kssssssssssk..",
  "..kcssssssssck..",
  "...kssssssssk...",
  "....kssssssk....",
  "..krwwwwwwwwrk..",
  "..krwwwbbwwwrk..",
  "..krrwwrrwwrrk..",
  "..krrrrrrrrrrk..",
  "..kkkkkkkkkkkk..",
  ".kppppppppppppk.",
  ".kppppppppppppk.",
  ".kppppppppppppk.",
  ".kppppppppppppk.",
  "..kkkkkkkkkkkk..",
];

/** Right hand, drawn separately so it can sweep when cards are dealt. */
export const CROUPIER_HAND = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "..............kk",
  ".............ksk",
  ".............ksk",
  "..............kk",
];

export const SUIT_BITMAPS: Record<"h" | "d" | "c" | "s", string[]> = {
  h: ["XX....XX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", ".XXXXXX.", "..XXXX..", "...XX...", "........"],
  d: ["...XX...", "..XXXX..", ".XXXXXX.", "XXXXXXXX", ".XXXXXX.", "..XXXX..", "...XX...", "........"],
  c: ["...XX...", "..XXXX..", "...XX...", ".XX..XX.", "XXXXXXXX", "XXXXXXXX", "...XX...", "..XXXX.."],
  s: ["...XX...", "..XXXX..", ".XXXXXX.", "XXXXXXXX", "XXXXXXXX", "...XX...", "..XXXX..", "........"],
};

export const SUIT_PATHS: Record<"h" | "d" | "c" | "s", string> = {
  h: toLayers(SUIT_BITMAPS.h, { X: "#000" })[0].d,
  d: toLayers(SUIT_BITMAPS.d, { X: "#000" })[0].d,
  c: toLayers(SUIT_BITMAPS.c, { X: "#000" })[0].d,
  s: toLayers(SUIT_BITMAPS.s, { X: "#000" })[0].d,
};
