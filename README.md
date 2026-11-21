# Postre Poker — online Texas Hold'em

A multiplayer poker game for playing with friends in the browser.

- **Backend:** Rust (axum + tokio), WebSockets for live tables, in-memory state.
- **Frontend:** SolidJS 2.0 (Vite).

## Features

- Create public or private tables (blinds, buy-in, 2–9 seats).
- Share the table link or code; friends join from any browser on your network.
- No-limit Hold'em: blinds, dealer button, check/call/raise/all-in, min-raise rules.
- Side pots for all-in players, correct showdown and split pots.
- Hole cards are only sent to the player who owns them; revealed at showdown.
- 30-second action timer (auto check/fold), automatic next hand.
- Table chat, hand history, and a live spectator count.

Chips live on the table only. There are no accounts or persistent bankroll, and
state is in memory, so a server restart clears all tables.

## Project layout

```
backend/            Rust server
  src/poker/        cards + 7-card hand evaluator (with tests)
  src/table.rs      table engine: betting, pots, showdown, timers (with tests)
  src/lobby.rs      table registry + per-table ticker
  src/web.rs        REST (/api/tables) and WebSocket (/ws/:code)
  src/protocol.rs   wire types
frontend/           Solid 2.0 app
  src/pages/        Lobby, TablePage
  src/components/   Card, Seat, ActionBar, Sidebar
```

## Run it

Requirements: Rust (stable), Node 20+.

### Development (hot reload)

```bash
# terminal 1
cd backend && cargo run

# terminal 2
cd frontend && npm install && npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` and `/ws` to the
backend on port 3000.

### Production (single binary serves the UI)

```bash
cd frontend && npm install && npm run build
cd ../backend && cargo run --release
```

Open http://localhost:3000.

### Playing with friends

Run the server on a machine everyone can reach (same Wi-Fi, or port-forward or
use a tunnel such as Tailscale). Create a table, then send friends the
"Invite friends" link. Use `http://<your-ip>:3000` (production) or
`http://<your-ip>:5173` (dev) in place of localhost.

Environment variables:

| Variable     | Default                       | Purpose                       |
| ------------ | ----------------------------- | ----------------------------- |
| `PORT`       | `3000`                        | HTTP port                     |
| `STATIC_DIR` | `../frontend/dist`            | Built frontend to serve       |
| `RUST_LOG`   | `poker_server=info,...`       | Log filter                    |

## Tests

```bash
cd backend && cargo test
cd frontend && npm run typecheck
```

## Security notes

This is built for trusted friends. The browser stores a random player id in
`localStorage`, and that id is what identifies a seat. Anyone who has it can
act for that seat, so do not expose the server to the public internet without
adding real authentication. Table codes are short and unguessable enough for
friends, but private tables are not access-controlled.
