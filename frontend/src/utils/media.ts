import { createSignal } from "solid-js";

/** Matches Tailwind's `max-sm:` variant (`--breakpoint-sm: 701px` in styles.css). */
const COMPACT_QUERY = "(max-width: 700px)";

const query = window.matchMedia(COMPACT_QUERY);
const [compact, setCompact] = createSignal(query.matches);
query.addEventListener("change", event => setCompact(event.matches));

/** Reactive: true on phone-sized screens, updated on resize and rotation. */
export const isCompact = compact;
