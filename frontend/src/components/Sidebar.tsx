import { createEffect, createSignal, For } from "solid-js";
import type { ChatMessage } from "../types";

interface SidebarProps {
  log: string[];
  chat: ChatMessage[];
  viewers: number;
  onChat: (text: string) => void;
}

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
    <aside class="sidebar">
      <section class="panel">
        <h3 class="panel-title">Hand history</h3>
        <div class="log" ref={el => (logEl = el)}>
          <For each={props.log}>{line => <div class="log-line">{line}</div>}</For>
        </div>
      </section>

      <section class="panel chat-panel">
        <h3 class="panel-title">
          Table chat <span class="viewers">{props.viewers} watching</span>
        </h3>
        <div class="chat" ref={el => (chatEl = el)}>
          <For each={props.chat}>
            {msg => (
              <div class="chat-line">
                <strong>{msg.name}</strong> {msg.text}
              </div>
            )}
          </For>
        </div>
        <form class="chat-form" onSubmit={submit}>
          <input
            class="chat-input"
            placeholder="Say something…"
            maxlength={300}
            value={draft()}
            onInput={e => setDraft(e.currentTarget.value)}
          />
          <button class="btn btn-small" type="submit">
            Send
          </button>
        </form>
      </section>
    </aside>
  );
}
