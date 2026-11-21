import { createEffect, createSignal, For } from "solid-js";
import type { ChatMessage } from "../types";
import { BTN_SMALL, INPUT, PANEL } from "../ui";

interface SidebarProps {
  log: string[];
  chat: ChatMessage[];
  viewers: number;
  onChat: (text: string) => void;
}

const HEADING = "mb-3 flex flex-wrap items-baseline justify-between gap-2 text-[10px] text-ink [text-shadow:none]";
const SCROLL = "flex h-[200px] flex-col gap-1 overflow-y-auto pr-1 text-xl lg:h-auto lg:min-h-0 lg:flex-auto";

export function Sidebar(props: SidebarProps) {
  const [draft, setDraft] = createSignal("");
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

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const text = draft().trim();
    if (!text) return;
    props.onChat(text);
    setDraft("");
  };

  return (
    <aside class="flex min-h-0 flex-col gap-4 lg:h-full lg:gap-2.5">
      <section class={`${PANEL} flex min-h-0 flex-col lg:flex-1 lg:basis-0 lg:px-3.5 lg:py-2.5`}>
        <h3 class={HEADING}>Hand history</h3>
        <div class={SCROLL} ref={el => (logEl = el)}>
          <For each={props.log}>{line => <div class="text-[#5a4426]">{line}</div>}</For>
        </div>
      </section>

      <section class={`${PANEL} flex min-h-0 flex-col lg:flex-1 lg:basis-0 lg:px-3.5 lg:py-2.5`}>
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
