import { createSignal, For, onSettled } from "solid-js";
import { getTable, loadIdentity, loadLook, socketUrl } from "../api";
import { ActionBar } from "../components/ActionBar";
import { Card } from "../components/Card";
import { Croupier } from "../components/Croupier";
import { SeatSpot } from "../components/Seat";
import { Sidebar } from "../components/Sidebar";
import { boardDelay, dealBoard, dealHand, type DealContext, TURN_MS } from "../dealing";
import type { Action, ClientMessage, ServerMessage, TableView } from "../types";

const STAGE_LABELS: Record<string, string> = {
  waiting: "Waiting for players",
  preflop: "Pre-flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
};

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
          retry = window.setTimeout(connect, 1500);
        }
      };
    };

    getTable(props.code)
      .then(() => {
        if (!disposed) connect();
      })
      .catch(error => {
        setFatal(error instanceof Error ? error.message : "Could not open table");
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

  const secondsLeft = () => {
    const d = deadline();
    if (d === null) return null;
    return Math.max(0, Math.ceil((d - clock()) / 1000));
  };

  const turnFraction = () => {
    const d = deadline();
    if (d === null) return null;
    return Math.min(1, Math.max(0, (d - clock()) / TURN_MS));
  };

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

  const inviteUrl = () => `${location.origin}/table/${props.code}`;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify("Copy the link from the box above");
    }
  };

  const leave = () => {
    const v = view();
    if (v && v.you !== null) send({ type: "stand" });
    props.navigate("/");
  };

  const sit = (seat: number) => send({ type: "sit", seat, look: loadLook() });
  const act = (action: Action) => send({ type: "act", action });

  return (
    <div class="table-page">
      <header class="topbar">
        <button class="ghost-btn" onClick={leave}>
          ← Lobby
        </button>
        <div class="table-title">
          <h1>{view()?.name ?? "Table"}</h1>
          <span class="blinds">
            Blinds {view()?.smallBlind ?? "–"}/{view()?.bigBlind ?? "–"} · Buy-in{" "}
            {view()?.buyIn.toLocaleString() ?? "–"}
          </span>
        </div>
        <div class="topbar-right">
          <span class={["conn", { live: connected() }]}>{connected() ? "Live" : "Reconnecting…"}</span>
          <button class="ghost-btn" onClick={copyInvite} title={inviteUrl()}>
            {copied() ? "Link copied" : "Invite friends"}
          </button>
          {view() !== null ? (
            <button class="ghost-btn" onClick={() => send({ type: "addBot" })}>
              + Bot
            </button>
          ) : null}
          {view() !== null && view()!.seats.some(s => s?.isBot) ? (
            <button class="ghost-btn" onClick={() => send({ type: "removeBots" })}>
              Remove bots
            </button>
          ) : null}
          {view() !== null && view()!.you !== null ? (
            <button class="ghost-btn" onClick={() => send({ type: "stand" })}>
              Stand up
            </button>
          ) : null}
        </div>
      </header>

      {fatal() ? (
        <div class="notice error">
          <p>{fatal()}</p>
          <button class="btn" onClick={() => props.navigate("/")}>
            Back to lobby
          </button>
        </div>
      ) : view() === null ? (
        <div class="notice">Connecting to the table…</div>
      ) : (
        <div class="room">
          <main class="main-column">
            <Croupier line={croupierLine()} dealing={dealing()} />

            <div class="felt-wrap">
              <div class="felt" ref={el => (feltEl = el)}>
                <div class="shoe" ref={el => (shoeEl = el)} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>

                <div class="felt-center">
                  <div class="stage-label">{STAGE_LABELS[view()!.stage]}</div>
                  <div class="board">
                    <For each={view()!.board}>
                      {(code, i) => <Card code={code} delay={boardDelay(i())} />}
                    </For>
                    {view()!.board.length === 0 ? <span class="board-empty">—</span> : null}
                  </div>
                  <div class="pot">Pot {view()!.pot.toLocaleString()}</div>
                  {view()!.stage === "showdown" && view()!.awards.length > 0 ? (
                    <div class="awards">
                      <For each={view()!.awards}>
                        {award => (
                          <div>
                            {view()!.seats[award.seat]?.name ?? `Seat ${award.seat + 1}`} wins{" "}
                            {award.amount.toLocaleString()}
                            {award.hand ? ` · ${award.hand}` : ""}
                          </div>
                        )}
                      </For>
                    </div>
                  ) : null}
                </div>

                <div class="deal-layer" ref={el => (layerEl = el)} aria-hidden="true" />

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

            {view()!.yourHand ? (
              <div class="hand-indicator">
                <span class="hand-label">Your hand</span>
                <span class="hand-name">{view()!.yourHand}</span>
              </div>
            ) : null}

            {view()!.actions ? (
              <ActionBar
                actions={view()!.actions!}
                pot={view()!.pot}
                currentBet={view()!.currentBet}
                onAct={act}
              />
            ) : (
              <div class="hint">
                {view()!.you === null
                  ? "Pick an open seat to join the table."
                  : view()!.stage === "waiting"
                    ? "Waiting for at least two players with chips. The hand starts automatically."
                    : view()!.stage === "showdown"
                      ? "Next hand starts in a few seconds."
                      : `Waiting for ${view()!.seats[view()!.toAct ?? -1]?.name ?? "the next player"}…`}
              </div>
            )}

            {toast() ? <div class="toast">{toast()}</div> : null}
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
