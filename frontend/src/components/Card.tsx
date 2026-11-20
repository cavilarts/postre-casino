import { For } from "solid-js";
import { faceLayers } from "../pixel/cardface";

export function Card(props: { code?: string; delay?: number }) {
  return (
    <span class={["card", { back: !props.code }]} style={`animation-delay:${props.delay ?? 0}ms`}>
      {props.code ? (
        <svg class="face" viewBox="0 0 24 34" shape-rendering="crispEdges" aria-label={props.code}>
          <For each={faceLayers(props.code)}>{layer => <path d={layer.d} fill={layer.color} />}</For>
        </svg>
      ) : null}
    </span>
  );
}
