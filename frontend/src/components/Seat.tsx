import { Show } from "solid-js";
import { holeDelay } from "../dealing";
import { Avatar } from "./Avatar";
import type { SeatView, TableView } from "../types";
import { Card } from "./Card";

/** Seats are placed on an ellipse with the viewer's seat at the bottom. */
export function seatPosition(seat: number, count: number, you: number | null) {
  const base = you ?? 0;
  const rel = (seat - base + count) % count;
  const angle = Math.PI / 2 + (2 * Math.PI * rel) / count;
  const x = 50 + 43 * Math.cos(angle);
  const y = 50 + 34 * Math.sin(angle);
  return { left: `${x}%`, top: `${y}%` };
}

interface SeatSpotProps {
  seat: number;
  view: TableView;
  secondsLeft: number | null;
  fraction: number | null;
  canSit: boolean;
  onSit: (seat: number) => void;
}

export function SeatSpot(props: SeatSpotProps) {
  const info = () => props.view.seats[props.seat];
  const position = () => seatPosition(props.seat, props.view.maxSeats, props.view.you);

  return (
    <div class="seat-spot" data-seat={props.seat} style={position()}>
      <Show
        when={info()}
        fallback={
          props.canSit ? (
            <button class="sit-btn" onClick={() => props.onSit(props.seat)}>
              <span class="sit-plus">+</span>
              <span>Sit here</span>
              <span class="sit-buyin">{props.view.buyIn.toLocaleString()}</span>
            </button>
          ) : (
            <div class="empty-seat">Open seat</div>
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
        "player",
        {
          turn: props.seat.isTurn,
          urgent: props.seat.isTurn && urgent(),
          folded: props.seat.folded,
          you: props.seat.isYou,
        },
      ]}
    >
      {props.seat.isTurn && props.fraction !== null ? (
        <svg class="ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <rect class="ring-track" x="1" y="1" width="98" height="98" rx="0" />
          <rect
            class="ring-fill"
            x="1"
            y="1"
            width="98"
            height="98"
            rx="0"
            pathLength="100"
            stroke-dasharray="100"
            stroke-dashoffset={100 * (1 - props.fraction)}
          />
        </svg>
      ) : null}
      <div class="portrait">
        <Avatar look={props.seat.look} size={32} />
      </div>
      {props.seat.isButton ? <span class="dealer-btn">D</span> : null}
      <div class="player-name">
        {props.seat.isBot ? <span class="bot-badge">BOT</span> : null}
        {props.seat.name}
      </div>
      <div class="player-stack">{props.seat.stack.toLocaleString()}</div>
      {status() ? <div class="player-status">{status()}</div> : null}
      {props.seat.isTurn && props.secondsLeft !== null ? (
        <div class="timer">{props.secondsLeft}s</div>
      ) : null}
      {showCards() ? (
        <div class="hole">
          <Card code={props.seat.hole[0]} delay={holeDelay(props.seat.seat, 0)} />
          <Card code={props.seat.hole[1]} delay={holeDelay(props.seat.seat, 1)} />
        </div>
      ) : null}
      {props.seat.bet > 0 ? <div class="bet-chip">{props.seat.bet.toLocaleString()}</div> : null}
    </div>
  );
}

