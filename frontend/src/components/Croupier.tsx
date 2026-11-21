import { For } from "solid-js";
import { CROUPIER_BODY, CROUPIER_HAND, CROUPIER_PALETTE, toLayers } from "../pixel/sprites";

const BODY = toLayers(CROUPIER_BODY, CROUPIER_PALETTE);
const HAND = toLayers(CROUPIER_HAND, CROUPIER_PALETTE);
const SCALE = 4;

export function Croupier(props: { line: string; dealing: boolean }) {
  return (
    <div class="relative flex justify-center">
      <div class="absolute bottom-full left-1/2 mb-2 w-max max-w-[320px] -translate-x-1/2 border-[3px] border-wood-dark bg-parchment px-3 py-1.5 text-xl text-ink shadow-pixel after:absolute after:-bottom-2 after:left-1/2 after:h-0 after:w-0 after:-translate-x-1/2 after:border-x-[8px] after:border-x-transparent after:border-t-[8px] after:border-t-wood-dark after:content-['']">
        {props.line}
      </div>
      <div class="flex items-end [filter:drop-shadow(4px_4px_0_var(--color-wood-dark))]">
        <svg
          class="block"
          viewBox={`0 0 16 ${CROUPIER_BODY.length}`}
          width={16 * SCALE}
          height={CROUPIER_BODY.length * SCALE}
          shape-rendering="crispEdges"
          aria-label="Croupier"
          role="img"
        >
          <For each={BODY}>{layer => <path d={layer.d} fill={layer.color} />}</For>
          <g
            class={[
              "[transform-box:view-box] [transform-origin:12px_10px]",
              { "animate-deal-sweep": props.dealing },
            ]}
          >
            <For each={HAND}>{layer => <path d={layer.d} fill={layer.color} />}</For>
          </g>
        </svg>
      </div>
    </div>
  );
}
