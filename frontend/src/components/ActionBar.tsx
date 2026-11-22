import { createMemo, createSignal } from "solid-js";
import type { Action, ActionsView } from "../types";
import { formatChips } from "../utils/format";
import { INPUT } from "../ui";
import { Card } from "./Card";

interface ActionBarProps {
  actions: ActionsView;
  pot: number;
  currentBet: number;
  /** The player's hole cards and hand name, repeated in the bar on phones where it covers their seat. */
  hole: string[];
  handName: string | null;
  onAct: (action: Action) => void;
}

const ACTION_BASE =
  "min-w-[118px] cursor-pointer border-[3px] border-wood-dark px-3.5 py-2 text-2xl text-ink shadow-[0_4px_0_var(--color-wood-dark)] transition-[transform,box-shadow] duration-[50ms] ease-[steps(2)] active:enabled:translate-y-[3px] active:enabled:shadow-[0_1px_0_var(--color-wood-dark)] max-sm:min-w-0 max-sm:flex-1 max-sm:py-1.5 max-sm:text-xl lg:px-3 lg:py-1.5 lg:text-[22px]";

const BTN_FOLD = `${ACTION_BASE} bg-[#e58b78] hover:enabled:bg-[#fbf0cf]`;
const BTN_CALL = `${ACTION_BASE} bg-green hover:enabled:bg-[#fbf0cf]`;
const BTN_RAISE = `${ACTION_BASE} bg-gold hover:enabled:bg-[#ffc857]`;

const CHIP =
  "cursor-pointer border-[3px] border-wood bg-parchment-dark px-2 text-xl text-ink hover:bg-[#fbf0cf] max-sm:min-h-[40px] max-sm:min-w-[52px]";

export function ActionBar(props: ActionBarProps) {
  const minTo = createMemo(() => props.actions.minRaiseTo);
  const maxTo = createMemo(() => props.actions.maxRaiseTo);
  const canRaise = () => props.actions.canRaise && maxTo() > props.currentBet;

  const [raiseTo, setRaiseTo] = createSignal(() => minTo());
  /** Raw text while the raise box is being edited, so clearing it doesn't write "0" back. */
  const [draft, setDraft] = createSignal<string | null>(null);

  /** Sets the raise from a preset, replacing whatever was typed. */
  const choose = (amount: number) => {
    setDraft(null);
    setRaiseTo(amount);
  };

  const clampedRaise = () => Math.min(Math.max(raiseTo() || 0, minTo()), maxTo());

  const submitRaise = () => {
    const to = clampedRaise();
    if (to >= maxTo()) {
      props.onAct({ type: "allIn" });
    } else {
      props.onAct({ type: "raise", amount: to });
    }
  };

  const potRaise = (fraction: number) => {
    const toCall = props.actions.toCall;
    const target = props.currentBet + Math.round((props.pot + toCall) * fraction);
    choose(target);
  };

  return (
    // On phones the bar sticks to the bottom of the screen so the player can act without scrolling.
    <div class="flex flex-wrap items-start gap-2.5 border-4 border-wood bg-parchment p-3 text-ink shadow-pixel max-sm:sticky max-sm:bottom-0 max-sm:z-30 max-sm:gap-2 max-sm:p-2 max-sm:pb-[calc(8px+env(safe-area-inset-bottom))] lg:gap-2 lg:px-2.5 lg:py-2">
      {props.hole.length > 0 ? (
        <div class="hidden self-center max-sm:flex max-sm:gap-0.5" title={props.handName ?? undefined}>
          <Card code={props.hole[0]} class="h-[42px] w-[30px]" />
          <Card code={props.hole[1]} class="h-[42px] w-[30px]" />
        </div>
      ) : null}
      <button class={BTN_FOLD} onClick={() => props.onAct({ type: "fold" })}>
        Fold
      </button>

      {props.actions.canCheck ? (
        <button class={BTN_CALL} onClick={() => props.onAct({ type: "check" })}>
          Check
        </button>
      ) : (
        <button class={BTN_CALL} onClick={() => props.onAct({ type: "call" })}>
          Call {formatChips(props.actions.toCall)}
        </button>
      )}

      {canRaise() ? (
        <div class="flex min-w-[260px] flex-1 flex-col gap-2 max-sm:min-w-0 max-sm:basis-full">
          <div class="flex flex-wrap gap-1.5">
            <button class={CHIP} onClick={() => choose(minTo())}>
              Min
            </button>
            <button class={CHIP} onClick={() => potRaise(0.5)}>
              ½ pot
            </button>
            <button class={CHIP} onClick={() => potRaise(1)}>
              Pot
            </button>
            <button class={CHIP} onClick={() => choose(maxTo())}>
              Max
            </button>
          </div>
          <div class="flex gap-2">
            <input
              class={`${INPUT} w-[130px] text-2xl tabular-nums max-sm:w-[100px] max-sm:text-xl lg:w-[110px]`}
              type="number"
              min={minTo()}
              max={maxTo()}
              step={1}
              value={draft() ?? String(raiseTo())}
              onInput={e => {
                const raw = e.currentTarget.value;
                setDraft(raw);
                setRaiseTo(raw === "" ? 0 : Number(raw));
              }}
              onBlur={() => setDraft(null)}
            />
            <button class={BTN_RAISE} onClick={submitRaise}>
              {clampedRaise() >= maxTo() ? "All-in" : `Raise to ${formatChips(clampedRaise())}`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
