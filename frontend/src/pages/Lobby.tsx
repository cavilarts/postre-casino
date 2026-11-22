import { createSignal, createStore, For, onSettled, Show } from "solid-js";
import { createTable, listTables, loadIdentity, loadLook, saveLook, saveName } from "../api";
import { AvatarCreator } from "../components/AvatarCreator";
import { Logo } from "../components/Logo";
import { NumberField } from "../components/NumberField";
import type { TableSummary } from "../types";
import { BTN_PRIMARY, BTN_SMALL, INPUT, PANEL } from "../ui";
import { errorMessage } from "../utils/errors";
import { formatChips } from "../utils/format";
import { LOBBY_STAGE_LABELS } from "../utils/labels";
import { normalizeTableCode, tablePath } from "../utils/table";

const LABEL = "flex flex-col gap-1 text-[#6b5232]";
const STEP = "mr-2 inline-grid size-6 place-items-center bg-wood-dark text-[10px] text-gold";

export function Lobby(props: { navigate: (to: string) => void }) {
  const [name, setName] = createSignal(loadIdentity().name);
  const [look, setLook] = createSignal(loadLook());
  const [tables, setTables] = createSignal<TableSummary[]>([]);
  const [listError, setListError] = createSignal<string | null>(null);
  const [nameError, setNameError] = createSignal<string | null>(null);
  const [formError, setFormError] = createSignal<string | null>(null);
  let nameInput: HTMLInputElement | undefined;
  const [busy, setBusy] = createSignal(false);
  const [joinCode, setJoinCode] = createSignal("");
  const [form, setForm] = createStore({
    name: "Friday night",
    smallBlind: 5,
    bigBlind: 10,
    buyIn: 1000,
    maxSeats: 6,
    private: true,
  });

  const refresh = async () => {
    try {
      setTables(await listTables());
      setListError(null);
    } catch (error) {
      setListError(errorMessage(error, "Something went wrong"));
    }
  };

  onSettled(() => {
    refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => clearInterval(timer);
  });

  const requireName = (): boolean => {
    const trimmed = name().trim();
    if (!trimmed) {
      setNameError("Choose a name so others know who you are");
      nameInput?.scrollIntoView({ behavior: "smooth", block: "center" });
      nameInput?.focus({ preventScroll: true });
      return false;
    }
    saveName(trimmed);
    return true;
  };

  const enter = (code: string) => {
    if (!requireName()) return;
    props.navigate(tablePath(code));
  };

  const onCreate = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!requireName()) return;
    setBusy(true);
    setFormError(null);
    try {
      const table = await createTable({
        name: form.name,
        smallBlind: Number(form.smallBlind),
        bigBlind: Number(form.bigBlind),
        buyIn: Number(form.buyIn),
        maxSeats: Number(form.maxSeats),
        private: form.private,
      });
      props.navigate(tablePath(table.code));
    } catch (error) {
      setFormError(errorMessage(error, "Something went wrong"));
      setBusy(false);
    }
  };

  const onJoin = (event: SubmitEvent) => {
    event.preventDefault();
    const code = joinCode().trim();
    if (code) enter(code);
  };

  return (
    <div class="mx-auto max-w-[1180px] px-5 pt-7 pb-[60px]">
      <header class="mb-[26px] flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-4 max-sm:flex-col max-sm:items-start max-sm:gap-3">
          <Logo height={45} class="block shrink-0 shadow-pixel" decorative />
          <div>
            <h1 class="text-xl text-cream">Postre Poker</h1>
            <p class="mt-2 text-[22px] text-muted">Texas Hold'em with your crew</p>
          </div>
        </div>
      </header>

      <div class="grid items-start gap-6 lg:grid-cols-[400px_1fr]">
        <section class={`${PANEL} lg:sticky lg:top-6`}>
          <h2 class="text-xs [text-shadow:none]">
            <span class={STEP}>1</span>Your player
          </h2>
          <p class="mt-1 mb-3.5 text-[#7a6442]">Pick a character and a name. This is how you appear at every table.</p>
          <AvatarCreator
            look={look()}
            onChange={next => {
              saveLook(next);
              setLook(next);
            }}
            name={name()}
            onNameChange={value => {
              setName(value);
              saveName(value.trim());
              if (value.trim()) setNameError(null);
            }}
            nameError={nameError()}
            nameRef={el => (nameInput = el)}
          />
        </section>

        <div class="flex flex-col gap-6">
          <section class={PANEL}>
            <h2 class="text-xs [text-shadow:none]">
              <span class={STEP}>2</span>Join a table
            </h2>
            <div class="mt-3 mb-4 flex flex-wrap items-center gap-3">
              <span class="text-[#6b5232]">Have a code from a friend?</span>
              <form class="flex gap-2" onSubmit={onJoin}>
                <input
                  class={`${INPUT} w-[150px] uppercase tracking-[0.1em]`}
                  placeholder="Table code"
                  maxlength={8}
                  value={joinCode()}
                  onInput={e => setJoinCode(normalizeTableCode(e.currentTarget.value))}
                />
                <button class={BTN_SMALL} type="submit">
                  Join
                </button>
              </form>
            </div>
            <h3 class="mb-2 text-[10px] text-[#6b5232] [text-shadow:none]">Open tables</h3>

            <Show when={listError()}>{message => <p class="my-1.5 text-[22px] text-red">{message()}</p>}</Show>

            <Show
              when={tables().length > 0}
              fallback={
                <p class="my-[1em] text-[#7a6442]">No public tables yet. Create one and share the link with friends.</p>
              }
            >
              <div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
                <For each={tables()}>
                  {t => (
                    <article class="flex flex-col gap-1.5 border-[3px] border-wood bg-parchment-dark p-3 shadow-pixel-sm">
                      <div class="flex items-center justify-between gap-2">
                        <h3 class="text-[10px] text-ink [text-shadow:none]">{t.name}</h3>
                        <span class="whitespace-nowrap border-2 border-green-dark bg-green px-2 text-lg text-wood-dark">
                          {LOBBY_STAGE_LABELS[t.stage]}
                        </span>
                      </div>
                      <p class="m-0 text-xl text-[#6b5232]">
                        Blinds {t.smallBlind}/{t.bigBlind} · Buy-in {formatChips(t.buyIn)}
                      </p>
                      <div class="mt-1.5 flex items-center justify-between text-xl text-[#6b5232]">
                        <span>
                          {t.players}/{t.maxSeats} seated
                        </span>
                        <button class={BTN_SMALL} onClick={() => enter(t.code)}>
                          Join
                        </button>
                      </div>
                    </article>
                  )}
                </For>
              </div>
            </Show>
          </section>

          <section class={PANEL}>
            <h2 class="text-xs [text-shadow:none]">
              <span class={STEP}>3</span>Or start your own
            </h2>
            <p class="mt-1 mb-3.5 text-[#7a6442]">Create a table, then invite friends with the link.</p>
            <form class="flex flex-col gap-3" onSubmit={onCreate}>
              <label class={LABEL}>
                <span>Table name</span>
                <input
                  class={INPUT}
                  value={form.name}
                  maxlength={40}
                  onInput={e => {
                    const value = e.currentTarget.value;
                    setForm(f => {
                      f.name = value;
                    });
                  }}
                />
              </label>
              <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
                <NumberField
                  label="Small blind"
                  min={1}
                  value={form.smallBlind}
                  onChange={value => {
                    setForm(f => {
                      f.smallBlind = value;
                    });
                  }}
                />
                <NumberField
                  label="Big blind"
                  min={1}
                  value={form.bigBlind}
                  onChange={value => {
                    setForm(f => {
                      f.bigBlind = value;
                    });
                  }}
                />
                <NumberField
                  label="Buy-in (chips)"
                  min={10}
                  value={form.buyIn}
                  onChange={value => {
                    setForm(f => {
                      f.buyIn = value;
                    });
                  }}
                />
                <label class={LABEL}>
                  <span>Seats</span>
                  <select
                    class={INPUT}
                    value={String(form.maxSeats)}
                    onChange={e => {
                      const value = Number(e.currentTarget.value);
                      setForm(f => {
                        f.maxSeats = value;
                      });
                    }}
                  >
                    <For each={[2, 3, 4, 5, 6, 7, 8, 9]}>{n => <option value={String(n)}>{n} players</option>}</For>
                  </select>
                </label>
              </div>
              <label class="flex items-center gap-2.5 text-[#6b5232]">
                <input
                  class={INPUT}
                  type="checkbox"
                  checked={form.private}
                  onChange={e => {
                    const value = e.currentTarget.checked;
                    setForm(f => {
                      f.private = value;
                    });
                  }}
                />
                <span>Private (hidden from the list, joinable by code or link)</span>
              </label>
              {formError() ? <p class="my-1.5 text-[22px] text-red">{formError()}</p> : null}
              <button class={BTN_PRIMARY} type="submit" disabled={busy()}>
                {busy() ? "Creating…" : "Create table"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
