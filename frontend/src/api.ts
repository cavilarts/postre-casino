import { DEFAULT_LOOK, type Look, sanitizeLook } from "./avatar/look";
import type { TableSummary } from "./types";

export interface Identity {
  playerId: string;
  name: string;
}

const ID_KEY = "poker.playerId";
const NAME_KEY = "poker.name";

function randomId(): string {
  // crypto.randomUUID is unavailable on plain-http LAN addresses, so build an id from getRandomValues.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

export function loadIdentity(): Identity {
  let playerId = localStorage.getItem(ID_KEY);
  if (!playerId) {
    playerId = randomId();
    localStorage.setItem(ID_KEY, playerId);
  }
  return { playerId, name: localStorage.getItem(NAME_KEY) ?? "" };
}

export function saveName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}

export interface NewTable {
  name: string;
  smallBlind: number;
  bigBlind: number;
  buyIn: number;
  maxSeats: number;
  private: boolean;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export async function listTables(): Promise<TableSummary[]> {
  return readJson(await fetch("/api/tables"));
}

export async function createTable(body: NewTable): Promise<TableSummary> {
  return readJson(
    await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function getTable(code: string): Promise<TableSummary> {
  return readJson(await fetch(`/api/tables/${encodeURIComponent(code)}`));
}

export function socketUrl(code: string, identity: Identity): string {
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  const params = new URLSearchParams({ player: identity.playerId, name: identity.name });
  return `${scheme}://${location.host}/ws/${encodeURIComponent(code)}?${params}`;
}

const LOOK_KEY = "poker.look";

export function loadLook(): Look {
  try {
    const raw = localStorage.getItem(LOOK_KEY);
    if (raw) return sanitizeLook(JSON.parse(raw));
  } catch {
    // fall through to the default look
  }
  return { ...DEFAULT_LOOK };
}

export function saveLook(look: Look): void {
  localStorage.setItem(LOOK_KEY, JSON.stringify(look));
}
