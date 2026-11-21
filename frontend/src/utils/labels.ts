import type { Stage } from "../types";

/** Short stage names for the lobby table list. */
export const LOBBY_STAGE_LABELS: Record<Stage, string> = {
  waiting: "Open",
  preflop: "Playing",
  flop: "Playing",
  turn: "Playing",
  river: "Playing",
  showdown: "Between hands",
};

/** Stage names for the felt. */
export const TABLE_STAGE_LABELS: Record<Stage, string> = {
  waiting: "Waiting for players",
  preflop: "Pre-flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
};
