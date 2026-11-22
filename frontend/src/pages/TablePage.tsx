import { createSignal, For, onSettled, Show } from "solid-js";
import { ApiError, getTable, loadIdentity, loadLook, socketUrl } from "../api";
import { ActionBar } from "../components/ActionBar";
import { Card } from "../components/Card";
import { Croupier } from "../components/Croupier";
import { SeatSpot } from "../components/Seat";
import { Sidebar } from "../components/Sidebar";
import { boardDelay, dealBoard, dealHand, type DealContext, TURN_MS } from "../dealing";
import type { Action, ClientMessage, ServerMessage, TableView } from "../types";
import { BTN, CARD_BACK_PATTERN, GHOST_BTN, PANEL } from "../ui";
import { copyText } from "../utils/clipboard";
import { errorMessage } from "../utils/errors";
import { formatChips } from "../utils/format";
import { TABLE_STAGE_LABELS } from "../utils/labels";
import { tableInviteUrl } from "../utils/table";
import { remainingFraction, secondsRemaining } from "../utils/time";

const TABLE_CLOSED = "This table has closed. Tables close after sitting empty for a while.";

const NOTICE = "mx-auto my-[60px] flex flex-col items-center gap-3.5 text-center text-muted";

const SHOE_FACE = `absolute h-[34px] w-14 ${CARD_BACK_PATTERN} shadow-pixel-xs`;

export function TablePage(props: { code: string; navigate: (to: string) => void }) {
  const [view, setView] = createSignal<TableView | null>(null);
  const [fatal, setFatal] = createSignal<string | null>(null);
  const [connected, setConnected] = createSignal(false);
  const [toast, setToast] = createSignal<string | null>(null);
  const [clock, setClock] = createSignal(Date.now());
  const [deadline, setDeadline] = createSignal<number | null>(null);
  const [copied, setCopied] = createSignal(false);
  const [dealing, setDealing] = createSignal(false);

  let socket: WebSocket | null = null;
  let toastTimer: number | undefined;
  let dealTimer: number | undefined;
  let feltEl: HTMLElement | undefined;
  let layerEl: HTMLElement | undefined;
  let shoeEl: HTMLElement | undefined;
  let lastHand = -1;
  let lastBoard = 0;

  const send = (message: ClientMessage) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  };

  const notify = (text: string) => {
    setToast(text);
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => setToast(null), 4000);
  };

  /** Runs deal animations before the new view renders, so card reveal timing matches the flights. */
  const animateDeal = (state: TableView) => {
    const ctx = dealContext();
    if (!ctx) return;
    if (lastHand !== -1 && state.handId !== lastHand) {
      const inHand = state.seats.flatMap(s => (s && s.inHand ? [s.seat] : []));
      if (inHand.length >= 2) {
        dealHand(ctx, inHand, state.button, state.maxSeats);
        setDealing(true);
        clearTimeout(dealTimer);
        dealTimer = window.setTimeout(() => setDealing(false), 1200);
      }
      lastBoard = 0;
    }
    if (lastHand !== -1 && state.board.length > lastBoard) {
      dealBoard(ctx, lastBoard, state.board.length);
    }
    lastHand = state.handId;
    lastBoard = state.board.length;
  };

  const dealContext = (): DealContext | null =>
    feltEl && layerEl && shoeEl ? { felt: feltEl, layer: layerEl, shoe: shoeEl } : null;

  onSettled(() => {
    let disposed = false;
    let retry: number | undefined;

    const connect = () => {
      const ws = new WebSocket(socketUrl(props.code, loadIdentity()));
      socket = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = event => {
        const message = JSON.parse(event.data) as ServerMessage;
        if (message.type === "state") {
          const state = message.state;
          animateDeal(state);
          setDeadline(state.turnMsLeft === null ? null : Date.now() + state.turnMsLeft);
          setView(state);
        } else {
          notify(message.message);
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!disposed) {
          retry = window.setTimeout(reconnect, 1500);
        }
      };
    };

    // A closed socket can mean the table was removed for being idle; check
    // before retrying so the page says so instead of reconnecting forever.
    const reconnect = () => {
      getTable(props.code)
        .then(() => {
          if (!disposed) connect();
        })
        .catch(error => {
          if (disposed) return;
          if (error instanceof ApiError && error.status === 404) {
            setFatal(TABLE_CLOSED);
          } else {
            retry = window.setTimeout(reconnect, 1500);
          }
        });
    };

    getTable(props.code)
      .then(() => {
        if (!disposed) connect();
      })
      .catch(error => {
        setFatal(errorMessage(error, "Could not open table"));
      });

    const ticker = window.setInterval(() => setClock(Date.now()), 200);

    return () => {
      disposed = true;
      clearInterval(ticker);
      clearTimeout(retry);
      clearTimeout(dealTimer);
      socket?.close();
    };
  });

  const secondsLeft = () => secondsRemaining(deadline(), clock());

  const turnFraction = () => remainingFraction(deadline(), clock(), TURN_MS);

  const seatNumbers = () => Array.from({ length: view()?.maxSeats ?? 0 }, (_, i) => i);

  const croupierLine = () => {
    const v = view();
    if (!v) return "Welcome in!";
    if (v.you !== null && v.toAct === v.you) return "Your move!";
    if (v.toAct !== null && v.seats[v.toAct]) return `${v.seats[v.toAct]!.name}, your action.`;
    switch (v.stage) {
      case "waiting":
        return "Pull up a chair. Two players start the game.";
      case "preflop":
        return "Place your bets, please.";
      case "showdown":
        return "Let's see those hands.";
      default:
        return "Action on the board.";
    }
  };

  const inviteUrl = () => tableInviteUrl(props.code);

  const copyInvite = async (viaMenu = false) => {
    if (!(await copyText(inviteUrl()))) {
      notify("Copy the link from the box above");
      return;
    }
    // The menu closes on selection, so confirm with a toast instead of the button label.
    if (viaMenu) notify("Invite link copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const leave = () => {
    const v = view();
    if (v && v.you !== null) send({ type: "stand" });
    props.navigate("/");
  };

  interface TableAction {
    label: string;
    run: (viaMenu?: boolean) => void;
    title?: string;
  }

  /** Table actions: a row of buttons on desktop, the ⋯ menu below `lg`. */
  const tableActions = (): TableAction[] => {
    const v = view();
    return [
      { label: copied() ? "Link copied" : "Invite friends", run: copyInvite, title: inviteUrl() } as TableAction,
      ...(v ? [{ label: "+ Bot", run: () => send({ type: "addBot" }) }] : []),
      ...(v?.seats.some(s => s?.isBot) ? [{ label: "Remove bots", run: () => send({ type: "removeBots" }) }] : []),
      ...(v && v.you !== null ? [{ label: "Stand up", run: () => send({ type: "stand" }) }] : []),
    ];
  };

  const [menuOpen, setMenuOpen] = createSignal(false);
  let menuEl: HTMLDivElement | undefined;
  let menuButton: HTMLButtonElement | undefined;

  const closeMenu = (refocus = false) => {
    setMenuOpen(false);
    if (refocus) menuButton?.focus();
  };

  onSettled(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (menuOpen() && menuEl && !menuEl.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  });

  const sit = (seat: number) => send({ type: "sit", seat, look: loadLook() });
  const act = (action: Action) => send({ type: "act", action });

  return (
    <div class="flex min-h-[100dvh] flex-col gap-3 px-5 pt-4 pb-6 lg:h-[100dvh] lg:min-h-0 lg:gap-2 lg:overflow-hidden lg:px-4 lg:pt-2.5 lg:pb-3">
      <header class="mx-auto flex w-full max-w-[1280px] items-center gap-4 max-lg:gap-2.5 lg:flex-none">
        <button class={`${GHOST_BTN} flex-none max-lg:px-2`} onClick={leave} aria-label="Back to lobby">
          ← <span class="max-sm:hidden">Lobby</span>
        </button>
        <div class="flex min-w-0 flex-1 flex-col gap-1.5 max-lg:gap-1">
          <h1 class="truncate text-sm max-sm:text-xs">{view()?.name ?? "Table"}</h1>
          <span class="truncate text-xl text-muted max-sm:text-lg">
            Blinds {view()?.smallBlind ?? "–"}/{view()?.bigBlind ?? "–"} · Buy-in{" "}
            {view() ? formatChips(view()!.buyIn) : "–"}
          </span>
        </div>
        <div class="flex flex-none items-center gap-2.5">
          <span
            class={[
              "border-[3px] bg-wood-dark px-2 text-xl",
              connected() ? "border-green-dark text-[#bff0a0]" : "border-wood text-muted",
            ]}
            role="status"
            title={connected() ? "Connected" : "Reconnecting…"}
          >
            {connected() ? "Live" : <span aria-label="Reconnecting…">…</span>}
          </span>
          <For each={tableActions()}>
            {action => (
              <button class={`${GHOST_BTN} max-lg:hidden`} onClick={() => action.run()} title={action.title}>
                {action.label}
              </button>
            )}
          </For>
          <div
            class="relative lg:hidden"
            ref={el => (menuEl = el)}
            onKeyDown={event => {
              if (event.key === "Escape" && menuOpen()) closeMenu(true);
            }}
          >
            <button
              ref={el => (menuButton = el)}
              class={`${GHOST_BTN} px-3`}
              aria-label="More actions"
              aria-expanded={menuOpen() ? "true" : "false"}
              aria-controls="table-actions"
              onClick={() => setMenuOpen(open => !open)}
            >
              ⋯
            </button>
            <Show when={menuOpen()}>
              <div
                id="table-actions"
                class="absolute right-0 top-full z-50 mt-2 flex min-w-[190px] flex-col gap-2 border-4 border-wood bg-parchment p-2 shadow-pixel"
              >
                <For each={tableActions()}>
                  {action => (
                    <button
                      class={`${GHOST_BTN} w-full text-left`}
                      title={action.title}
                      onClick={() => {
                        action.run(true);
                        closeMenu(true);
                      }}
                    >
                      {action.label}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </header>

      {fatal() ? (
        <div class={`${NOTICE} ${PANEL} max-w-md px-6 py-5`} role="alert">
          <p class="m-0 text-[22px] text-red">{fatal()}</p>
          <button class={BTN} onClick={() => props.navigate("/")}>
            Back to lobby
          </button>
        </div>
      ) : view() === null ? (
        <div class={NOTICE}>Connecting to the table…</div>
      ) : (
        <div class="mx-auto grid w-full max-w-[1280px] flex-1 grid-cols-[minmax(0,1fr)_330px] gap-4.5 max-lg:grid-cols-1 lg:min-h-0 lg:flex-auto lg:grid-rows-[minmax(0,1fr)]">
          <main class="flex min-w-0 flex-col gap-3.5 lg:h-full lg:min-h-0 lg:gap-2">
            <div class="relative flex flex-1 flex-col pt-32 max-sm:pt-20 lg:min-h-0">
              <div
                class={[
                  "relative z-20 aspect-[16/10.2] min-h-[360px] w-full flex-1 max-sm:min-h-0 lg:aspect-auto lg:min-h-[240px]",
                  // Phones stack seats down the sides, so bigger tables need a taller felt.
                  view()!.maxSeats > 6 ? "max-sm:aspect-[1/1.5]" : "max-sm:aspect-[1/1.1]",
                ]}
                ref={el => (feltEl = el)}
              >
                <div class="absolute inset-x-0 top-[calc(8%_-_48px)] flex justify-center max-sm:origin-bottom max-sm:scale-75">
                  <Croupier line={croupierLine()} dealing={dealing()} />
                </div>

                <div class="absolute inset-x-[12%] inset-y-[8%]">
                  <div class="absolute inset-0 rounded-[50%] bg-wood-dark shadow-[6px_6px_0_var(--color-wood-dark)]" />
                  <div class="absolute inset-[6px] rounded-[50%] bg-wood" />
                  <div class="absolute inset-[10px] rounded-[50%] bg-wood-light" />
                  <div class="absolute inset-6 rounded-[50%] bg-felt-1 bg-[conic-gradient(var(--color-felt-1)_25%,var(--color-felt-2)_0_50%,var(--color-felt-1)_0_75%,var(--color-felt-2)_0)] bg-[length:16px_16px] shadow-[inset_0_0_0_4px_var(--color-wood-dark)]" />
                </div>

                <div class="absolute inset-0 z-10">
                  <div class="absolute left-1/2 top-[14%] z-[3] h-10 w-14 -translate-x-1/2" ref={el => (shoeEl = el)} aria-hidden="true">
                    <span class={`${SHOE_FACE} left-0`} />
                    <span class={`${SHOE_FACE} left-0.5 top-[3px]`} />
                    <span class={`${SHOE_FACE} left-1 top-1.5`} />
                  </div>

                  <div class="pointer-events-none absolute left-1/2 top-1/2 flex w-[70%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2.5 text-center max-sm:top-[44%] max-sm:w-[50%] max-sm:gap-1.5">
                    <div class="font-display text-[9px] tracking-[0.04em] text-cream [text-shadow:2px_2px_0_var(--color-wood-dark)]">
                      {TABLE_STAGE_LABELS[view()!.stage]}
                    </div>
                    <div
                      class="flex min-h-[100px] flex-wrap items-center justify-center gap-2.5 max-sm:min-h-[42px] max-sm:gap-1"
                      data-board
                    >
                      <For each={view()!.board}>
                        {(code, i) => (
                          <Card
                            code={code}
                            delay={boardDelay(i())}
                            class="h-24 w-[68px] max-sm:h-[42px] max-sm:w-[30px]"
                            board
                          />
                        )}
                      </For>
                      {view()!.board.length === 0 ? <span class="text-3xl text-white/40">—</span> : null}
                    </div>
                    <div class="border-[3px] border-wood-dark bg-gold px-2.5 py-1.5 font-display text-[11px] text-wood-dark shadow-pixel-sm">
                      Pot {formatChips(view()!.pot)}
                    </div>
                    {view()!.stage === "showdown" && view()!.awards.length > 0 ? (
                      <div class="flex flex-col border-[3px] border-gold bg-[rgb(43_26_16_/_0.8)] px-2.5 py-0.5 text-2xl text-cream">
                        <For each={view()!.awards}>
                          {award => (
                            <div>
                              {view()!.seats[award.seat]?.name ?? `Seat ${award.seat + 1}`} wins{" "}
                              {formatChips(award.amount)}
                              {award.hand ? ` · ${award.hand}` : ""}
                            </div>
                          )}
                        </For>
                      </div>
                    ) : null}
                  </div>

                  <div class="pointer-events-none absolute inset-0 z-[6] overflow-visible" ref={el => (layerEl = el)} aria-hidden="true" />

                  <For each={seatNumbers()}>
                    {seat => (
                      <SeatSpot
                        seat={seat}
                        view={view()!}
                        secondsLeft={secondsLeft()}
                        fraction={turnFraction()}
                        canSit={view()!.you === null && view()!.seats[seat] === null}
                        onSit={sit}
                      />
                    )}
                  </For>
                </div>
              </div>
            </div>

            {view()!.yourHand ? (
              <div class="flex items-center justify-center gap-3 self-center border-[3px] border-wood bg-parchment px-3.5 py-1.5 text-ink shadow-pixel-sm">
                <span class="text-xl text-[#6b5232]">Your hand</span>
                <span class="font-display text-[11px] text-ink">{view()!.yourHand}</span>
              </div>
            ) : null}

            {view()!.actions ? (
              <ActionBar
                actions={view()!.actions!}
                pot={view()!.pot}
                currentBet={view()!.currentBet}
                hole={view()!.you !== null ? (view()!.seats[view()!.you!]?.hole ?? []) : []}
                handName={view()!.yourHand}
                onAct={act}
              />
            ) : (
              <div class="p-1.5 text-center text-2xl text-cream [text-shadow:2px_2px_0_var(--color-wood-dark)] lg:p-0.5 lg:text-[22px]">
                {view()!.you === null
                  ? "Pick an open seat to join the table."
                  : view()!.stage === "waiting"
                    ? "Waiting for at least two players with chips. The hand starts automatically."
                    : view()!.stage === "showdown"
                      ? "Next hand starts in a few seconds."
                      : `Waiting for ${view()!.seats[view()!.toAct ?? -1]?.name ?? "the next player"}…`}
              </div>
            )}

            {toast() ? (
              <div
                role="status"
                class="fixed bottom-6 left-1/2 z-40 max-w-[calc(100vw-32px)] -translate-x-1/2 border-4 border-wood-dark bg-[#f5c2b5] px-4 py-2 text-[22px] text-wood-dark shadow-pixel max-sm:top-16 max-sm:bottom-auto max-sm:text-xl"
              >
                {toast()}
              </div>
            ) : null}
          </main>

          <Sidebar
            log={view()!.log}
            chat={view()!.chat}
            viewers={view()!.viewers}
            onChat={text => send({ type: "chat", text })}
          />
        </div>
      )}
    </div>
  );
}
