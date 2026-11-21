/**
 * Shared utility recipes for repeated controls. Each is a complete class list so
 * conflicting utilities never need to be merged at the call site.
 */

export const PANEL = "border-4 border-wood bg-parchment p-4 text-ink shadow-pixel";

export const INPUT =
  "min-w-0 border-[3px] border-wood bg-[#fff6dc] px-2.5 py-1.5 text-ink shadow-[inset_0_3px_0_rgb(0_0_0_/_0.12)] focus:border-gold focus:outline-none";

const BTN_BASE =
  "cursor-pointer border-[3px] border-wood-dark px-3.5 py-1.5 text-[22px] text-ink shadow-[0_4px_0_var(--color-wood-dark)] transition-[transform,box-shadow] duration-[50ms] ease-[steps(2)] active:enabled:translate-y-[3px] active:enabled:shadow-[0_1px_0_var(--color-wood-dark)] disabled:cursor-default disabled:opacity-55";

export const BTN = `${BTN_BASE} bg-parchment hover:enabled:bg-[#fbf0cf]`;

export const BTN_SMALL =
  "cursor-pointer border-[3px] border-wood-dark bg-parchment px-2.5 py-0.5 text-xl text-ink shadow-[0_4px_0_var(--color-wood-dark)] transition-[transform,box-shadow] duration-[50ms] ease-[steps(2)] hover:enabled:bg-[#fbf0cf] active:enabled:translate-y-[3px] active:enabled:shadow-[0_1px_0_var(--color-wood-dark)] disabled:cursor-default disabled:opacity-55";

export const BTN_PRIMARY = `${BTN_BASE} bg-gold hover:enabled:bg-[#ffc857]`;

export const GHOST_BTN =
  "cursor-pointer border-[3px] border-wood-dark bg-parchment px-2.5 py-1 text-xl text-ink shadow-[0_4px_0_var(--color-wood-dark)] hover:bg-[#fbf0cf] active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-wood-dark)]";

export const ARROW =
  "cursor-pointer border-[3px] border-wood bg-parchment-dark px-2 py-0 text-lg text-ink hover:bg-[#fbf0cf]";
