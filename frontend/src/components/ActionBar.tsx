import { createMemo, createSignal } from "solid-js";
import type { Action, ActionsView } from "../types";
import { formatChips } from "../utils/format";
import { INPUT } from "../ui";

interface ActionBarProps {
  actions: ActionsView;
  pot: number;
  currentBet: number;
  onAct: (action: Action) => void;
}

const ACTION_BASE =
  "min-w-[118px] cursor-pointer border-[3px] border-wood-dark px-3.5 py-2 text-2xl text-ink shadow-[0_4px_0_var(--color-wood-dark)] transition-[transform,box-shadow] duration-[50ms] ease-[steps(2)] active:enabled:translate-y-[3px] active:enabled:shadow-[0_1px_0_var(--color-wood-dark)] lg:px-3 lg:py-1.5 lg:text-[22px]";

const BTN_FOLD = `${ACTION_BASE} bg-[#e58b78] hover:enabled:bg-[#fbf0cf]`;
const BTN_CALL = `${ACTION_BASE} bg-green hover:enabled:bg-[#fbf0cf]`;
const BTN_RAISE = `${ACTION_BASE} bg-gold hover:enabled:bg-[#ffc857]`;

const CHIP = "cursor-pointer border-[3px] border-wood bg-parchment-dark px-2 text-xl text-ink hover:bg-[#fbf0cf]";

export function ActionBar(props: ActionBarProps) {
  const minTo = createMemo(() => props.actions.minRaiseTo);
  const maxTo = createMemo(() => props.actions.maxRaiseTo);
  const canRaise = () => maxTo() > props.currentBet;

  const [raiseTo, setRaiseTo] = createSignal(() => minTo());

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
    setRaiseTo(target);
  };

  return (
    <div class="flex flex-wrap items-start gap-2.5 border-4 border-wood bg-parchment p-3 text-ink shadow-pixel lg:gap-2 lg:px-2.5 lg:py-2">
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
        <div class="flex min-w-[260px] flex-1 flex-col gap-2">
          <div class="flex flex-wrap gap-1.5">
            <button class={CHIP} onClick={() => setRaiseTo(minTo())}>
              Min
            </button>
            <button class={CHIP} onClick={() => potRaise(0.5)}>
              ½ pot
            </button>
            <button class={CHIP} onClick={() => potRaise(1)}>
              Pot
            </button>
            <button class={CHIP} onClick={() => setRaiseTo(maxTo())}>
              Max
            </button>
          </div>
          <div class="flex gap-2">
            <input
              class={`${INPUT} w-[130px] text-2xl tabular-nums lg:w-[110px]`}
              type="number"
              min={minTo()}
              max={maxTo()}
              step={1}
              value={raiseTo()}
              onInput={e => setRaiseTo(Number(e.currentTarget.value))}
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
