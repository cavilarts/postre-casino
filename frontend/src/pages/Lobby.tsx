import { createSignal, createStore, For, onSettled, Show } from "solid-js";
import { createTable, listTables, loadIdentity, loadLook, saveLook, saveName } from "../api";
import { AvatarCreator } from "../components/AvatarCreator";
import type { TableSummary } from "../types";

const STAGE_LABELS: Record<string, string> = {
  waiting: "Open",
  preflop: "Playing",
  flop: "Playing",
  turn: "Playing",
  river: "Playing",
  showdown: "Between hands",
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function Lobby(props: { navigate: (to: string) => void }) {
  const [name, setName] = createSignal(loadIdentity().name);
  const [look, setLook] = createSignal(loadLook());
  const [tables, setTables] = createSignal<TableSummary[]>([]);
  const [listError, setListError] = createSignal<string | null>(null);
  const [formError, setFormError] = createSignal<string | null>(null);
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
      setListError(messageOf(error));
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
      setFormError("Choose a display name first");
      return false;
    }
    saveName(trimmed);
    return true;
  };

  const enter = (code: string) => {
    if (!requireName()) return;
    props.navigate(`/table/${code.toUpperCase()}`);
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
      props.navigate(`/table/${table.code}`);
    } catch (error) {
      setFormError(messageOf(error));
      setBusy(false);
    }
  };

  const onJoin = (event: SubmitEvent) => {
    event.preventDefault();
    const code = joinCode().trim();
    if (code) enter(code);
  };

  return (
    <div class="lobby">
      <header class="brand-bar">
        <div class="brand">
          <span class="brand-mark">♠</span>
          <div>
            <h1>Felt &amp; Friends</h1>
            <p>Texas Hold'em with your crew</p>
          </div>
        </div>
        <label class="name-field">
          <span>Your name</span>
          <input
            value={name()}
            maxlength={20}
            placeholder="Enter a name"
            onInput={e => {
              setName(e.currentTarget.value);
              saveName(e.currentTarget.value.trim());
            }}
          />
        </label>
      </header>

      <section class="panel creator-panel">
        <h2>Your character</h2>
        <p class="muted">This is how you appear at every table you sit at.</p>
        <AvatarCreator
          look={look()}
          onChange={next => {
            saveLook(next);
            setLook(next);
          }}
        />
      </section>

      <div class="lobby-grid">
        <section class="panel">
          <div class="panel-head">
            <h2>Open tables</h2>
            <form class="join-form" onSubmit={onJoin}>
              <input
                placeholder="Table code"
                maxlength={8}
                value={joinCode()}
                onInput={e => setJoinCode(e.currentTarget.value.toUpperCase())}
              />
              <button class="btn btn-small" type="submit">
                Join
              </button>
            </form>
          </div>

          <Show when={listError()}>
            {message => <p class="error-text">{message()}</p>}
          </Show>

          <Show
            when={tables().length > 0}
            fallback={<p class="muted">No public tables yet. Create one and share the link with friends.</p>}
          >
            <div class="table-list">
              <For each={tables()}>
                {t => (
                  <article class="table-card">
                    <div class="table-card-head">
                      <h3>{t.name}</h3>
                      <span class="stage-pill">{STAGE_LABELS[t.stage]}</span>
                    </div>
                    <p class="muted">
                      Blinds {t.smallBlind}/{t.bigBlind} · Buy-in {t.buyIn.toLocaleString()}
                    </p>
                    <div class="table-card-foot">
                      <span>
                        {t.players}/{t.maxSeats} seated
                      </span>
                      <button class="btn btn-small" onClick={() => enter(t.code)}>
                        Join
                      </button>
                    </div>
                  </article>
                )}
              </For>
            </div>
          </Show>
        </section>

        <section class="panel">
          <h2>Create a table</h2>
          <form class="create-form" onSubmit={onCreate}>
            <label>
              <span>Table name</span>
              <input
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
            <div class="form-row">
              <label>
                <span>Small blind</span>
                <input
                  type="number"
                  min={1}
                  value={form.smallBlind}
                  onInput={e => {
                    const value = Number(e.currentTarget.value);
                    setForm(f => {
                      f.smallBlind = value;
                    });
                  }}
                />
              </label>
              <label>
                <span>Big blind</span>
                <input
                  type="number"
                  min={1}
                  value={form.bigBlind}
                  onInput={e => {
                    const value = Number(e.currentTarget.value);
                    setForm(f => {
                      f.bigBlind = value;
                    });
                  }}
                />
              </label>
            </div>
            <div class="form-row">
              <label>
                <span>Buy-in (chips)</span>
                <input
                  type="number"
                  min={10}
                  value={form.buyIn}
                  onInput={e => {
                    const value = Number(e.currentTarget.value);
                    setForm(f => {
                      f.buyIn = value;
                    });
                  }}
                />
              </label>
              <label>
                <span>Seats</span>
                <select
                  value={String(form.maxSeats)}
                  onChange={e => {
                    const value = Number(e.currentTarget.value);
                    setForm(f => {
                      f.maxSeats = value;
                    });
                  }}
                >
                  <For each={[2, 3, 4, 5, 6, 7, 8, 9]}>
                    {n => <option value={String(n)}>{n} players</option>}
                  </For>
                </select>
              </label>
            </div>
            <label class="check">
              <input
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
            {formError() ? <p class="error-text">{formError()}</p> : null}
            <button class="btn btn-primary" type="submit" disabled={busy()}>
              {busy() ? "Creating…" : "Create table"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
