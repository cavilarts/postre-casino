/** Turns an unknown thrown value into text that is safe to render. */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
