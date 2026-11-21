/** Table codes are stored and shared in upper case, but users type them in any case. */
export function normalizeTableCode(code: string): string {
  return code.trim().toUpperCase();
}

/** In-app route for a table. */
export function tablePath(code: string): string {
  return `/table/${normalizeTableCode(code)}`;
}

/** Absolute link that can be shared with other players. */
export function tableInviteUrl(code: string): string {
  return `${location.origin}${tablePath(code)}`;
}
