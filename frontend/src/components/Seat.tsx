import { Show } from "solid-js";
import { holeDelay } from "../dealing";
import { formatChips } from "../utils/format";
import { isCompact } from "../utils/media";
import { seatPosition } from "../utils/seats";
import { Avatar } from "./Avatar";
import type { SeatView, TableView } from "../types";
import { Card } from "./Card";

interface SeatSpotProps {
  seat: number;
  view: TableView;
  secondsLeft: number | null;
  fraction: number | null;
  canSit: boolean;
  onSit: (seat: number) => void;
}

const SIT_BTN =
  "relative flex min-h-[78px] w-[124px] cursor-pointer flex-col items-center justify-center gap-0.5 overflow-visible border-[3px] border-dashed border-wood-dark bg-[rgb(247_237_208_/_0.9)] px-2 py-1.5 text-center text-[22px] text-ink hover:bg-[#fff6dc] max-sm:min-h-[52px] max-sm:w-[76px] max-sm:p-1 max-sm:text-base";

const EMPTY_SEAT =
  "relative grid min-h-[78px] w-[124px] place-items-center overflow-visible border-[3px] border-dashed border-wood-light bg-[rgb(43_26_16_/_0.35)] px-2 py-1.5 text-center text-xl text-[rgb(247_237_208_/_0.55)] max-sm:min-h-[52px] max-sm:w-[76px] max-sm:p-1 max-sm:text-base";

const PLAYER =
  "relative min-h-[78px] w-[124px] overflow-visible border-[3px] border-wood-dark px-2 py-1.5 text-center text-ink shadow-pixel max-sm:min-h-[52px] max-sm:w-[76px] max-sm:p-1 max-sm:text-base";

const CARD_BACK_SIZE = "h-[46px] w-8 max-sm:h-6 max-sm:w-[18px] max-sm:border-2 max-sm:after:hidden";
const CARD_FACE_SIZE = "h-12 w-[34px] max-sm:h-8 max-sm:w-[23px]";

export function SeatSpot(props: SeatSpotProps) {
  const info = () => props.view.seats[props.seat];
  const position = () => seatPosition(props.seat, props.view.maxSeats, props.view.you);

  return (
    <div class="absolute z-[2] -translate-x-1/2 -translate-y-1/2 short-desk:scale-80" data-seat={props.seat} style={position()}>
      <Show
        when={info()}
        fallback={
          props.canSit ? (
            <button class={SIT_BTN} onClick={() => props.onSit(props.seat)}>
              <span class="font-display text-sm leading-[1.4]">+</span>
              <span>Sit here</span>
              <span class="text-xl text-[#7a6442] max-sm:text-base">{formatChips(props.view.buyIn)}</span>
            </button>
          ) : (
            <div class={EMPTY_SEAT}>Open seat</div>
          )
        }
      >
        {s => (
          <Occupied
            seat={s()}
            stage={props.view.stage}
            secondsLeft={props.secondsLeft}
            fraction={props.fraction}
          />
        )}
      </Show>
    </div>
  );
}

function Occupied(props: {
  seat: SeatView;
  stage: string;
  secondsLeft: number | null;
  fraction: number | null;
}) {
  const status = () => {
    if (props.seat.leaving) return "Leaving";
    if (props.seat.away) return "Away";
    if (props.seat.sittingOut) return "Sitting out";
    if (props.seat.allIn) return "All-in";
    if (props.seat.folded) return "Folded";
    if (props.seat.stack === 0 && !props.seat.inHand) return "Busted";
    if (!props.seat.inHand && props.stage !== "waiting" && props.stage !== "showdown") return "Waiting";
    return null;
  };
  const showCards = () => props.seat.inHand || props.seat.hole.length > 0;
  const urgent = () => (props.secondsLeft ?? 99) <= 8;

  return (
    <div
      class={[
        PLAYER,
        props.seat.isYou ? "bg-[#fbeec4] outline-[3px] outline-gold outline-offset-2" : "bg-parchment",
        {
          "animate-turn-pulse": props.seat.isTurn,
          "opacity-50": props.seat.folded,
        },
      ]}
    >
      {props.seat.isTurn && props.fraction !== null ? (
        <svg
          class="pointer-events-none absolute -inset-1.5 z-[2] h-[calc(100%+12px)] w-[calc(100%+12px)] overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect
            class="fill-none stroke-[rgba(43,26,16,0.25)] [vector-effect:non-scaling-stroke]"
            x="1"
            y="1"
            width="98"
            height="98"
            rx="0"
            stroke-width="4"
          />
          <rect
            class={[
              "fill-none [vector-effect:non-scaling-stroke] transition-[stroke-dashoffset,stroke] duration-200",
              urgent() ? "stroke-red" : "stroke-gold",
            ]}
            x="1"
            y="1"
            width="98"
            height="98"
            rx="0"
            pathLength="100"
            stroke-dasharray="100"
            stroke-dashoffset={100 * (1 - props.fraction)}
            stroke-width="4"
          />
        </svg>
      ) : null}
      {/* Phones: avatar sits beside the name. Desktop: it floats above the box. */}
      <div class="max-sm:flex max-sm:items-center max-sm:gap-1">
        <div
          class={[
            "absolute -top-[46px] left-1/2 z-[3] -translate-x-1/2 border-[3px] border-wood-dark bg-cream p-0.5 shadow-pixel-xs max-sm:static max-sm:flex-none max-sm:translate-x-0 max-sm:border-2 max-sm:p-0 max-sm:shadow-none",
            // Phones mark bots with a blue frame instead of the BOT badge, which would crowd out the name.
            { "max-sm:border-[#5c6f8a]": props.seat.isBot },
          ]}
        >
          <Avatar look={props.seat.look} size={isCompact() ? 20 : 32} />
        </div>
        {props.seat.isButton ? (
          <span class="absolute -left-3 -top-3 z-[3] grid size-6 place-items-center border-[3px] border-wood-dark bg-cream font-display text-[9px] text-wood-dark max-sm:size-5 max-sm:border-2 max-sm:text-[7px]">
            D
          </span>
        ) : null}
        <div class="overflow-hidden text-ellipsis whitespace-nowrap text-[22px] max-sm:min-w-0 max-sm:flex-1 max-sm:text-left max-sm:text-base max-sm:leading-4">
          {props.seat.isBot ? (
            <span class="mr-1 inline-block align-[2px] border-2 border-wood-dark bg-[#5c6f8a] px-[3px] py-0.5 font-display text-[6px] text-cream max-sm:sr-only">
              BOT
            </span>
          ) : null}
          {props.seat.name}
        </div>
      </div>
      {/* Phones: the bet sits beside the stack. Desktop: it hangs below the box. */}
      <div class="max-sm:mt-0.5 max-sm:flex max-sm:items-center max-sm:justify-center max-sm:gap-1">
        <div class="text-[22px] text-green-dark tabular-nums max-sm:text-base max-sm:leading-4">
          {formatChips(props.seat.stack)}
        </div>
        {props.seat.bet > 0 ? (
          <div class="absolute -bottom-4 left-1/2 z-[3] -translate-x-1/2 whitespace-nowrap border-[3px] border-wood-dark bg-cream px-1.5 py-[3px] font-display text-[8px] text-wood-dark shadow-pixel-xs before:mr-[5px] before:inline-block before:size-2 before:rounded-full before:border-2 before:border-wood-dark before:bg-gold before:content-[''] before:[vertical-align:-1px] max-sm:static max-sm:translate-x-0 max-sm:border-2 max-sm:px-0.5 max-sm:py-px max-sm:text-[7px] max-sm:shadow-none max-sm:before:mr-0.5 max-sm:before:size-1.5 max-sm:before:border">
            {formatChips(props.seat.bet)}
          </div>
        ) : null}
      </div>
      {status() ? <div class="mt-0.5 font-display text-[7px] text-red max-sm:text-[6px]">{status()}</div> : null}
      {props.seat.isTurn && props.secondsLeft !== null ? (
        <div
          class={[
            "absolute -right-2.5 -top-3.5 z-[3] border-[3px] border-wood-dark px-[5px] py-[3px] font-display text-[8px]",
            urgent() ? "bg-red text-cream" : "bg-gold text-wood-dark",
          ]}
        >
          {props.secondsLeft}s
        </div>
      ) : null}
      {showCards() ? (
        <div class="mt-1.5 flex min-h-[46px] justify-center gap-1 max-sm:mt-1 max-sm:min-h-6 max-sm:gap-0.5">
          <Card
            code={props.seat.hole[0]}
            class={props.seat.hole[0] ? CARD_FACE_SIZE : CARD_BACK_SIZE}
            delay={holeDelay(props.seat.seat, 0)}
          />
          <Card
            code={props.seat.hole[1]}
            class={props.seat.hole[1] ? CARD_FACE_SIZE : CARD_BACK_SIZE}
            delay={holeDelay(props.seat.seat, 1)}
          />
        </div>
      ) : null}
    </div>
  );
}
