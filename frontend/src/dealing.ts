export const TURN_MS = 30_000;

const FLIGHT_MS = 420;
const DEAL_STEP_MS = 150;
const BOARD_STEP_MS = 230;

export interface DealContext {
  felt: HTMLElement;
  layer: HTMLElement;
  shoe: HTMLElement;
}

const timing = {
  holeStart: 0,
  holeOrder: [] as number[],
  boardStart: 0,
  boardFrom: 0,
};

/** Milliseconds until a dealt hole card lands, so the face appears on arrival. */
export function holeDelay(seat: number, round: number): number {
  const k = timing.holeOrder.indexOf(seat);
  if (k < 0) return 0;
  const slot = round * timing.holeOrder.length + k;
  return Math.max(0, timing.holeStart + slot * DEAL_STEP_MS + FLIGHT_MS - Date.now());
}

/** Milliseconds until a board card lands. */
export function boardDelay(index: number): number {
  const slot = index - timing.boardFrom;
  if (slot < 0) return 0;
  return Math.max(0, timing.boardStart + slot * BOARD_STEP_MS + FLIGHT_MS - Date.now());
}

function fly(ctx: DealContext, target: Element, delay: number, dx = 0, dy = 0) {
  const base = ctx.layer.getBoundingClientRect();
  const from = ctx.shoe.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const x0 = from.left + from.width / 2 - base.left;
  const y0 = from.top + from.height / 2 - base.top;
  const x1 = to.left + to.width / 2 - base.left + dx;
  const y1 = to.top + to.height / 2 - base.top + dy;

  const el = document.createElement("div");
  el.className = "card back flying";
  ctx.layer.appendChild(el);

  const animation = el.animate(
    [
      { transform: `translate(${x0}px, ${y0}px) translate(-50%, -50%) rotate(-8deg) scale(0.85)`, opacity: 0 },
      { opacity: 1, offset: 0.15 },
      { transform: `translate(${x1}px, ${y1}px) translate(-50%, -50%) rotate(0deg) scale(1)`, opacity: 1 },
    ],
    { duration: FLIGHT_MS, delay, easing: "cubic-bezier(.22,.8,.3,1)", fill: "both" },
  );
  animation.onfinish = () => el.remove();
}

/** Deals two hole cards to each player in the hand, starting left of the button. */
export function dealHand(ctx: DealContext, inHand: number[], button: number | null, maxSeats: number) {
  const start = button ?? maxSeats - 1;
  const order = Array.from({ length: maxSeats }, (_, k) => (start + 1 + k) % maxSeats).filter(s =>
    inHand.includes(s),
  );
  timing.holeStart = Date.now();
  timing.holeOrder = order;
  timing.boardFrom = 0;

  for (let round = 0; round < 2; round++) {
    order.forEach((seat, k) => {
      const seatEl = ctx.felt.querySelector(`[data-seat="${seat}"]`);
      if (!seatEl) return;
      const slot = round * order.length + k;
      fly(ctx, seatEl, slot * DEAL_STEP_MS);
    });
  }
}

/** Flies newly revealed community cards from the shoe to the board. */
export function dealBoard(ctx: DealContext, from: number, to: number) {
  const boardEl = ctx.felt.querySelector(".board");
  if (!boardEl) return;
  timing.boardFrom = from;
  timing.boardStart = Date.now();
  const count = to - from;
  for (let i = from; i < to; i++) {
    const offset = (i - from - (count - 1) / 2) * 72;
    fly(ctx, boardEl, (i - from) * BOARD_STEP_MS, offset, 0);
  }
}
