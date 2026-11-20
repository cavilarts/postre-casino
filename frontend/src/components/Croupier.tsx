import { For } from "solid-js";
import { CROUPIER_BODY, CROUPIER_HAND, CROUPIER_PALETTE, toLayers } from "../pixel/sprites";

const BODY = toLayers(CROUPIER_BODY, CROUPIER_PALETTE);
const HAND = toLayers(CROUPIER_HAND, CROUPIER_PALETTE);
const SCALE = 4;

export function Croupier(props: { line: string; dealing: boolean }) {
  return (
    <div class="croupier-row">
      <div class="croupier-bubble">{props.line}</div>
      <div class="croupier">
        <svg
          class="croupier-svg"
          viewBox={`0 0 16 ${CROUPIER_BODY.length}`}
          width={16 * SCALE}
          height={CROUPIER_BODY.length * SCALE}
          shape-rendering="crispEdges"
          aria-label="Croupier"
          role="img"
        >
          <For each={BODY}>{layer => <path d={layer.d} fill={layer.color} />}</For>
          <g class={["hand", { wave: props.dealing }]}>
            <For each={HAND}>{layer => <path d={layer.d} fill={layer.color} />}</For>
          </g>
        </svg>
      </div>
    </div>
  );
}
