import { For } from "solid-js";
import { faceLayers } from "../pixel/cardface";

const DEFAULT_SIZE = "h-16 w-[46px] max-sm:h-[50px] max-sm:w-9";

const BACK =
  "border-[3px] border-wood-dark bg-[conic-gradient(#2f6f73_25%,#e7d9a8_0_50%,#2f6f73_0_75%,#e7d9a8_0)] bg-[length:8px_8px] shadow-pixel-sm after:pointer-events-none after:absolute after:inset-[3px] after:border-2 after:border-[#e7d9a8] after:content-['']";

const FACE = "border-0 bg-none shadow-none";

export function Card(props: { code?: string; delay?: number; class?: string; board?: boolean }) {
  return (
    <span
      class={["relative flex-none animate-card-in", props.class ?? DEFAULT_SIZE, props.code ? FACE : BACK]}
      style={`animation-delay:${props.delay ?? 0}ms`}
    >
      {props.code ? (
        <svg
          class={[
            "block h-full w-full",
            props.board
              ? "[filter:drop-shadow(4px_4px_0_var(--color-wood-dark))]"
              : "[filter:drop-shadow(3px_3px_0_var(--color-wood-dark))]",
          ]}
          viewBox="0 0 24 34"
          shape-rendering="crispEdges"
          aria-label={props.code}
        >
          <For each={faceLayers(props.code)}>{layer => <path d={layer.d} fill={layer.color} />}</For>
        </svg>
      ) : null}
    </span>
  );
}
