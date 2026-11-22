import { For } from "solid-js";
import { faceLayers } from "../pixel/cardface";
import { CARD_BACK_FRAME, CARD_BACK_PATTERN } from "../ui";

const DEFAULT_SIZE = "h-16 w-[46px] max-sm:h-[50px] max-sm:w-9";

const BACK = `${CARD_BACK_PATTERN} shadow-pixel-sm ${CARD_BACK_FRAME}`;

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
          {/* One layer per color, so color is a stable key: changes update d in place. */}
          <For each={faceLayers(props.code)} keyed={layer => layer.color}>
            {layer => <path d={layer().d} fill={layer().color} />}
          </For>
        </svg>
      ) : null}
    </span>
  );
}
