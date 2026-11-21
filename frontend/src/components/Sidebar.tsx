import { createEffect, createSignal, For } from "solid-js";
import type { ChatMessage } from "../types";
import { BTN_SMALL, INPUT, PANEL } from "../ui";

interface SidebarProps {
  log: string[];
  chat: ChatMessage[];
  viewers: number;
  onChat: (text: string) => void;
}

type Tab = "chat" | "history";

const HEADING = "mb-3 flex flex-wrap items-baseline justify-between gap-2 text-[10px] text-ink [text-shadow:none] max-lg:hidden";
const SCROLL = "flex h-[200px] flex-col gap-1 overflow-y-auto pr-1 text-xl max-lg:h-[180px] lg:h-auto lg:min-h-0 lg:flex-auto";
const TAB =
  "flex-1 cursor-pointer border-[3px] border-b-0 border-wood px-2 py-1 text-xl aria-selected:bg-parchment aria-selected:text-ink";

/**
 * Hand history and chat. Desktop shows both panels side by side in the column;
 * below `lg` (where the sidebar stacks under the table) they share one tabbed panel.
 */
export function Sidebar(props: SidebarProps) {
  const [draft, setDraft] = createSignal("");
  const [tab, setTab] = createSignal<Tab>("chat");
  let logEl: HTMLDivElement | undefined;
  let chatEl: HTMLDivElement | undefined;

  createEffect(
    () => props.log.length,
    () => {
      if (logEl) logEl.scrollTop = logEl.scrollHeight;
    },
  );
  createEffect(
    () => props.chat.length,
    () => {
      if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
    },
  );
  // A list hidden behind the other tab can't scroll, so jump to its end when it is shown.
  createEffect(tab, current => {
    const el = current === "chat" ? chatEl : logEl;
    if (el) el.scrollTop = el.scrollHeight;
  });

  // Tabs pattern: Left/Right (and Home/End) switch tabs and move focus; only the active tab is a tab stop.
  const onTabKey = (event: KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next: Tab = event.key === "Home" ? "chat" : event.key === "End" ? "history" : tab() === "chat" ? "history" : "chat";
    setTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const text = draft().trim();
    if (!text) return;
    props.onChat(text);
    setDraft("");
  };

  return (
    <aside class="flex min-h-0 flex-col gap-4 max-lg:gap-0 lg:h-full lg:gap-2.5">
      <div role="tablist" aria-label="Table panels" class="flex gap-1.5 lg:hidden" onKeyDown={onTabKey}>
        <button
          type="button"
          role="tab"
          id="tab-chat"
          aria-controls="panel-chat"
          aria-selected={tab() === "chat" ? "true" : "false"}
          tabindex={tab() === "chat" ? 0 : -1}
          class={`${TAB} bg-parchment-dark text-[#6b5232]`}
          onClick={() => setTab("chat")}
        >
          Chat · {props.viewers} watching
        </button>
        <button
          type="button"
          role="tab"
          id="tab-history"
          aria-controls="panel-history"
          aria-selected={tab() === "history" ? "true" : "false"}
          tabindex={tab() === "history" ? 0 : -1}
          class={`${TAB} bg-parchment-dark text-[#6b5232]`}
          onClick={() => setTab("history")}
        >
          Hand history
        </button>
      </div>

      <section
        id="panel-history"
        role="tabpanel"
        aria-labelledby="tab-history"
        class={[
          `${PANEL} flex min-h-0 flex-col lg:flex-1 lg:basis-0 lg:px-3.5 lg:py-2.5`,
          { "max-lg:hidden": tab() !== "history" },
        ]}
      >
        <h3 class={HEADING}>Hand history</h3>
        <div class={SCROLL} ref={el => (logEl = el)}>
          <For each={props.log}>{line => <div class="text-[#5a4426]">{line}</div>}</For>
        </div>
      </section>

      <section
        id="panel-chat"
        role="tabpanel"
        aria-labelledby="tab-chat"
        class={[
          `${PANEL} flex min-h-0 flex-col lg:flex-1 lg:basis-0 lg:px-3.5 lg:py-2.5`,
          { "max-lg:hidden": tab() !== "chat" },
        ]}
      >
        <h3 class={HEADING}>
          Table chat <span class="text-xl text-[#7a6442]">{props.viewers} watching</span>
        </h3>
        <div class={SCROLL} ref={el => (chatEl = el)}>
          <For each={props.chat}>
            {msg => (
              <div class="text-ink">
                <strong class="font-normal text-red">{msg.name}</strong> {msg.text}
              </div>
            )}
          </For>
        </div>
        <form class="mt-2.5 flex gap-2" onSubmit={submit}>
          <input
            class={`${INPUT} flex-1 text-[22px]`}
            placeholder="Say something…"
            maxlength={300}
            value={draft()}
            onInput={e => setDraft(e.currentTarget.value)}
          />
          <button class={BTN_SMALL} type="submit">
            Send
          </button>
        </form>
      </section>
    </aside>
  );
}
