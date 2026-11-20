import { For } from "solid-js";
import { composeAvatar, type Look } from "../avatar/look";

export function Avatar(props: { look: Look; size: number }) {
  return (
    <svg
      class="avatar"
      viewBox="0 0 16 16"
      width={props.size}
      height={props.size}
      shape-rendering="crispEdges"
      role="img"
      aria-label="Character"
    >
      <For each={composeAvatar(props.look)}>{layer => <path d={layer.d} fill={layer.color} />}</For>
    </svg>
  );
}
