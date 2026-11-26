export type Stage = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";

export interface TableSummary {
  code: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  buyIn: number;
  maxSeats: number;
  private: boolean;
  players: number;
  stage: Stage;
}

import type { Look } from "./avatar/look";

export interface SeatView {
  seat: number;
  name: string;
  look: Look;
  isBot: boolean;
  stack: number;
  bet: number;
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  leaving: boolean;
  away: boolean;
  isYou: boolean;
  isButton: boolean;
  isTurn: boolean;
  hole: string[];
}

export interface ActionsView {
  canCheck: boolean;
  toCall: number;
  minRaiseTo: number;
  maxRaiseTo: number;
  /** False when an incomplete all-in raise left betting closed to this player. */
  canRaise: boolean;
}

export interface Award {
  seat: number;
  amount: number;
  hand: string | null;
}

export interface ChatMessage {
  name: string;
  text: string;
}

export interface TableView extends Omit<TableSummary, "players"> {
  handId: number;
  board: string[];
  pot: number;
  currentBet: number;
  minRaise: number;
  button: number | null;
  toAct: number | null;
  turnMsLeft: number | null;
  seats: (SeatView | null)[];
  you: number | null;
  actions: ActionsView | null;
  yourHand: string | null;
  awards: Award[];
  reveal: boolean;
  log: string[];
  chat: ChatMessage[];
  viewers: number;
}

export type Action =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  | { type: "raise"; amount: number }
  | { type: "allIn" };

export type ClientMessage =
  | { type: "sit"; seat: number; look: Look }
  | { type: "stand" }
  | { type: "addBot" }
  | { type: "removeBots" }
  | { type: "act"; action: Action }
  | { type: "chat"; text: string };

export type ServerMessage =
  | { type: "state"; state: TableView }
  | { type: "error"; message: string };
