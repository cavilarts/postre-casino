import { For } from "solid-js";
import { LOGO } from "../pixel/logo";

/** Postre Poker logo: the four suits side by side on a pixel strip. */
export function Logo(props: { height: number; class?: string }) {
  return (
    <svg
      class={props.class}
      viewBox={`0 0 ${LOGO.width} ${LOGO.height}`}
      width={(props.height * LOGO.width) / LOGO.height}
      height={props.height}
      shape-rendering="crispEdges"
      role="img"
      aria-label="Postre Poker logo"
    >
      <For each={LOGO.layers}>{layer => <path d={layer.d} fill={layer.color} />}</For>
    </svg>
  );
}
