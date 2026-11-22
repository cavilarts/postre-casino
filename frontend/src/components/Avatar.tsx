import { For } from "solid-js";
import { composeAvatar, type Look } from "../avatar/look";

export function Avatar(props: { look: Look; size: number; class?: string }) {
  return (
    <svg
      class={`block [image-rendering:pixelated] ${props.class ?? ""}`}
      viewBox="0 0 16 16"
      width={props.size}
      height={props.size}
      shape-rendering="crispEdges"
      role="img"
      aria-label="Character"
    >
      {/* One layer per color, so color is a stable key: changes update d in place. */}
      <For each={composeAvatar(props.look)} keyed={layer => layer.color}>
        {layer => <path d={layer().d} fill={layer().color} />}
      </For>
    </svg>
  );
}
