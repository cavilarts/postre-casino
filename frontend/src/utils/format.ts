/** Chip amounts are shown with thousands separators everywhere in the app. */
export function formatChips(amount: number): string {
  return amount.toLocaleString();
}
