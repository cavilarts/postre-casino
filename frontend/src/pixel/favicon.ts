import { suitTile, type PixelArt } from "./logo";

// Build-time only: nothing in the app imports this module. favicon.test.ts keeps
// public/favicon.svg in sync with ICON (run `npm run favicon` to regenerate it).

/**
 * Square browser-tab icon (♠ ♥ / ♦ ♣), since a row would be unreadable at 16px.
 * 32x32 so it maps 1:1 at 32px (16px tabs on 2x screens) and halves evenly at 16px.
 */
export const ICON: PixelArt = suitTile(2, 3, 4);

/** Standalone SVG markup for a piece of pixel art. */
export function toSvg(art: PixelArt): string {
  const paths = art.layers.map(l => `<path d="${l.d}" fill="${l.color}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${art.width} ${art.height}" shape-rendering="crispEdges">${paths}</svg>\n`;
}
