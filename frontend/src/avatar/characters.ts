// Playable characters. Each is drawn as 16x16 grids overlaid in order ('.' is
// transparent). Every character offers the same options: a tone and a hair
// swatch (whose meaning and colours depend on the character), plus the shared
// accent colour, headwear and glasses from look.ts.
import { GLASSES, HAIR, HEAD, HEAD_FEMALE, OUTFITS } from "./parts";

/** A named choice that sets one or more palette letters. */
export interface Swatch {
  name: string;
  colors: Record<string, string>;
}

export interface Character {
  name: string;
  layers: string[][];
  /** Drawn only when no headwear is chosen (the cake's candle, the queen's crown). */
  bare?: string[][];
  toneLabel: string;
  tones: Swatch[];
  hairLabel: string;
  hairs: Swatch[];
  /** Where headwear sits, relative to the human head the hats were drawn for. */
  hatOffset: [number, number];
  /** Glasses already positioned over this character's eyes. */
  glasses: string[];
}

/** Moves a 16x16 grid by (dx, dy), clipping whatever falls off the edge. */
export function shift(grid: string[], dx: number, dy: number): string[] {
  return Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => grid[y - dy]?.[x - dx] ?? ".").join(""),
  );
}

const swatches = (letter: string, entries: [string, string][]): Swatch[] =>
  entries.map(([name, color]) => ({ name, colors: { [letter]: color } }));

const SKIN_TONES = swatches("S", [
  ["Fair", "#f0c49a"],
  ["Golden", "#d9a071"],
  ["Tan", "#a86f4a"],
  ["Deep", "#6b4226"],
]);

const HAIR_TONES = swatches("H", [
  ["Chestnut", "#6b4423"],
  ["Jet", "#2a2a33"],
  ["Ginger", "#c9872e"],
  ["Silver", "#9a9a9a"],
]);

const CAKE = [
  "................",
  "................",
  "................",
  "................",
  "...KKKKKKKKKK...",
  "..KCCCCCCCCCCK..",
  "..KCCACCCCACCK..",
  "..KCFCCFCCCFCK..",
  "..KFFFFFFFFFFK..",
  "..KFFEFFFFEFFK..",
  "..KFPFMFFMFPFK..",
  "..KFFFFMMFFFFK..",
  "..KAAAAAAAAAAK..",
  "..KFFFFFFFFFFK..",
  ".KWWWWWWWWWWWWK.",
  "..KKKKKKKKKKKK..",
];

const CAKE_CANDLE = [
  "................",
  ".......Y........",
  ".......P........",
  ".......P........",
  ...Array<string>(12).fill("................"),
];

const SQUIRREL = [
  "................",
  ".KKKK...K....K..",
  "KhhhhK.KRK..KRK.",
  "KhHHHhKKKKKKKKK.",
  "KhHHHHhKRRRRRRK.",
  "KhHhhHhKRERRERK.",
  "KhHHHHhKRCPPCRK.",
  ".KhHHHhKRCCCCRK.",
  ".KhHHhK.KCWWCK..",
  "KhHHHhK..KKKK...",
  "KhHhHHhKAAAAAAK.",
  "KhHHHHhKRCCCCRK.",
  "KhHHHHhKRCCCCRK.",
  ".KhHHhKKRCCCCRK.",
  "..KKKK.KRCCCCRK.",
  ".......KKKKKKKK.",
];

const SQUIRREL_GLASSES = [
  "................",
  "................",
  "................",
  "................",
  "........GGGGGG..",
  "........GLGGLG..",
  ...Array<string>(10).fill("................"),
];

const CAT = [
  "................",
  "...K........K...",
  "..KOK......KOK..",
  "..KPOKKKKKKOPK..",
  "..KOOODOODOOOK..",
  "..KOOOOOOOOOOK..",
  "..KOOgOOOOgOOK..",
  "..KOOOWPPWOOOK..",
  ".KKOWWWMMWWWOKK.",
  "...KOOWWWWOOK...",
  "....KAAYYAAK....",
  "...KOOOWWOOOK...",
  "..KOOOWWWWOOOK..",
  "..KOOOWWWWOOOK..",
  "..KOOOOOOOOOOK..",
  "..KKKKKKKKKKKK..",
];

const QUEEN_ROBE = [
  ...Array<string>(10).fill("................"),
  "...KWBWWWWBWK...",
  "..KAAAWWWWAAAK..",
  "..KAAAAYYAAAAK..",
  "..KAAAAAAAAAAK..",
  "..KAAAAAAAAAAK..",
  "..KKKKKKKKKKKK..",
];

const QUEEN_CROWN = [
  "...K...KK...K...",
  "...KK.KYYK.KK...",
  "...KYKYAAYKYK...",
  "...KYYYYYYYYK...",
  "...KKKKKKKKKK...",
  ...Array<string>(11).fill("................"),
];

const BABY = [
  "........K.......",
  ".......KHK......",
  "....KKKKHKKK....",
  "...KSSSSSSSSK...",
  "..KSSSSSSSSSSK..",
  "..KSSSSSSSSSSK..",
  ".KSSEWSSSSEWSSK.",
  ".KSSEESSSSEESSK.",
  ".KSPPSSSSSSPPSK.",
  ".KSSSSAAAASSSSK.",
  "..KSSSSAASSSSK..",
  "...KSSSSSSSSK...",
  "....KKKKKKKK....",
  "...KAAWWWWAAK...",
  "..KAAAWWWWAAAK..",
  "..KKKKKKKKKKKK..",
];

const human = (name: string, layers: string[][], bare?: string[][]): Character => ({
  name,
  layers,
  bare,
  toneLabel: "Skin",
  tones: SKIN_TONES,
  hairLabel: "Hair",
  hairs: HAIR_TONES,
  hatOffset: [0, 0],
  glasses: GLASSES,
});

/** Indexed by Look.character. Keep the count in sync with Look::CHARACTER_COUNT on the server. */
export const CHARACTERS: Character[] = [
  human("Man", [OUTFITS[0], HEAD, HAIR[0]]),
  human("Woman", [OUTFITS[1], HEAD_FEMALE, HAIR[2]]),
  {
    name: "Cake face",
    layers: [CAKE],
    bare: [CAKE_CANDLE],
    toneLabel: "Flavour",
    tones: swatches("F", [
      ["Vanilla", "#e8b878"],
      ["Caramel", "#c98a4b"],
      ["Chocolate", "#8a5a36"],
      ["Red velvet", "#b5443a"],
    ]),
    hairLabel: "Frosting",
    hairs: swatches("C", [
      ["Cream", "#fff3e0"],
      ["Strawberry", "#f6b8c8"],
      ["Mint", "#bfe8cf"],
      ["Lemon", "#f7e08a"],
    ]),
    hatOffset: [0, 3],
    glasses: shift(GLASSES, 0, 3),
  },
  {
    name: "Squirrel",
    layers: [SQUIRREL],
    toneLabel: "Fur",
    tones: [
      { name: "Red", colors: { R: "#b5651d", C: "#f3dfc1" } },
      { name: "Grey", colors: { R: "#a3a3ad", C: "#ecebe6" } },
      { name: "Brown", colors: { R: "#8a5a34", C: "#e9d3b4" } },
      { name: "Golden", colors: { R: "#d9a04a", C: "#fbebc8" } },
    ],
    hairLabel: "Tail",
    hairs: [
      { name: "Rust", colors: { H: "#c0702a", h: "#7a4012" } },
      { name: "Grey", colors: { H: "#8e8e99", h: "#5e5e66" } },
      { name: "Chestnut", colors: { H: "#7a4a28", h: "#4e2e14" } },
      { name: "Snow", colors: { H: "#f0eadc", h: "#b8ae9a" } },
    ],
    hatOffset: [3, 0],
    glasses: SQUIRREL_GLASSES,
  },
  {
    name: "Cat",
    layers: [CAT],
    toneLabel: "Fur",
    tones: [
      { name: "Orange", colors: { O: "#e08a3c" } },
      { name: "Grey", colors: { O: "#9a9aa6" } },
      { name: "Black", colors: { O: "#45454f" } },
      { name: "Cream", colors: { O: "#e9d3a8" } },
    ].map(t => ({ ...t, colors: { ...t.colors, g: "#6fbf4a" } })),
    hairLabel: "Stripes",
    hairs: swatches("D", [
      ["Ginger", "#b05f1f"],
      ["Charcoal", "#2f2f36"],
      ["Brown", "#6b4423"],
      ["Silver", "#d2d2da"],
    ]),
    hatOffset: [0, 0],
    glasses: GLASSES,
  },
  human("Queen", [QUEEN_ROBE, HEAD_FEMALE, HAIR[1]], [QUEEN_CROWN]),
  human("Baby", [BABY]),
];
