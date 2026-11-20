import { createMemo, createSignal } from "solid-js";
import type { Action, ActionsView } from "../types";

interface ActionBarProps {
  actions: ActionsView;
  pot: number;
  currentBet: number;
  onAct: (action: Action) => void;
}

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
    <div class="action-bar">
      <button class="btn btn-fold" onClick={() => props.onAct({ type: "fold" })}>
        Fold
      </button>

      {props.actions.canCheck ? (
        <button class="btn btn-call" onClick={() => props.onAct({ type: "check" })}>
          Check
        </button>
      ) : (
        <button class="btn btn-call" onClick={() => props.onAct({ type: "call" })}>
          Call {props.actions.toCall.toLocaleString()}
        </button>
      )}

      {canRaise() ? (
        <div class="raise-group">
          <div class="presets">
            <button class="chip-preset" onClick={() => setRaiseTo(minTo())}>
              Min
            </button>
            <button class="chip-preset" onClick={() => potRaise(0.5)}>
              ½ pot
            </button>
            <button class="chip-preset" onClick={() => potRaise(1)}>
              Pot
            </button>
            <button class="chip-preset" onClick={() => setRaiseTo(maxTo())}>
              Max
            </button>
          </div>
          <div class="raise-row">
            <input
              class="raise-input"
              type="number"
              min={minTo()}
              max={maxTo()}
              step={1}
              value={raiseTo()}
              onInput={e => setRaiseTo(Number(e.currentTarget.value))}
            />
            <button class="btn btn-raise" onClick={submitRaise}>
              {clampedRaise() >= maxTo() ? "All-in" : `Raise to ${clampedRaise().toLocaleString()}`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
