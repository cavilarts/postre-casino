import { For } from "solid-js";
import { LOGO } from "../pixel/logo";

/**
 * Postre Poker logo: the four suits side by side on a pixel strip.
 * Pass `decorative` when a visible title sits next to it, so screen readers skip it.
 */
export function Logo(props: { height: number; class?: string; decorative?: boolean }) {
  return (
    <svg
      class={props.class}
      viewBox={`0 0 ${LOGO.width} ${LOGO.height}`}
      width={(props.height * LOGO.width) / LOGO.height}
      height={props.height}
      shape-rendering="crispEdges"
      role={props.decorative ? undefined : "img"}
      aria-label={props.decorative ? undefined : "Postre Poker logo"}
      aria-hidden={props.decorative ? "true" : undefined}
    >
      <For each={LOGO.layers}>{layer => <path d={layer.d} fill={layer.color} />}</For>
    </svg>
  );
}
