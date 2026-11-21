import { For, Show } from "solid-js";
import { CHARACTERS } from "../avatar/characters";
import { ACCENTS, DEFAULT_LOOK, HAT_NAMES, type Look, OPTION_COUNTS, randomLook } from "../avatar/look";
import { ARROW, BTN_SMALL, INPUT } from "../ui";
import { Avatar } from "./Avatar";

type Field = "tone" | "hair" | "accent" | "hat";

interface Row {
  field: Field;
  label: string;
  names: string[];
}

interface AvatarCreatorProps {
  look: Look;
  onChange: (look: Look) => void;
  name: string;
  onNameChange: (name: string) => void;
  nameError: string | null;
  nameRef?: (el: HTMLInputElement) => void;
}

const OPTION_LABEL = "w-[92px] shrink-0 text-[#6b5232]";

/** Character picker, preview, name and the options every character shares. */
export function AvatarCreator(props: AvatarCreatorProps) {
  const character = () => CHARACTERS[props.look.character] ?? CHARACTERS[0];

  const rows = (): Row[] => [
    {
      field: "tone",
      label: character().toneLabel,
      names: character().tones.map(t => t.name),
    },
    {
      field: "hair",
      label: character().hairLabel,
      names: character().hairs.map(h => h.name),
    },
    { field: "accent", label: "Colour", names: ACCENTS.map(a => a.name) },
    { field: "hat", label: "Headwear", names: HAT_NAMES },
  ];

  const step = (field: Field, delta: number) => {
    const count = OPTION_COUNTS[field];
    props.onChange({
      ...props.look,
      [field]: (props.look[field] + delta + count) % count,
    });
  };

  let pickerEl: HTMLDivElement | undefined;

  /** Radio group keys: arrows move (and select) with wrap-around, Home/End jump to the ends. */
  const onPickerKey = (event: KeyboardEvent) => {
    const count = CHARACTERS.length;
    const current = props.look.character;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? (current + 1) % count
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? (current - 1 + count) % count
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? count - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    props.onChange({ ...props.look, character: next });
    pickerEl?.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus();
  };

  return (
    <div class="flex flex-col gap-4">
      <div
        role="radiogroup"
        aria-label="Character"
        class="grid grid-cols-7 gap-1.5"
        ref={el => (pickerEl = el)}
        onKeyDown={onPickerKey}
      >
        <For each={CHARACTERS}>
          {(c, i) => {
            const selected = () => props.look.character === i();
            return (
              <button
                type="button"
                role="radio"
                aria-checked={selected() ? "true" : "false"}
                tabindex={selected() ? 0 : -1}
                aria-label={c.name}
                title={c.name}
                class={`cursor-pointer border-[3px] p-1 ${
                  selected()
                    ? "border-gold bg-[#fff6dc] shadow-pixel-xs"
                    : "border-wood bg-parchment-dark hover:bg-[#fbf0cf]"
                }`}
                onClick={() => props.onChange({ ...props.look, character: i() })}
              >
                <Avatar look={{ ...props.look, character: i() }} size={40} class="h-auto w-full" />
              </button>
            );
          }}
        </For>
      </div>

      <div class="flex flex-col items-center gap-2">
        <div class="border-4 border-wood bg-[#fff6dc] p-2.5 shadow-pixel">
          <Avatar look={props.look} size={128} />
        </div>
        <p class="m-0 text-center text-[22px] text-ink">
          {props.name.trim() || "Your name"}
          <span class="text-[#6b5232]"> · {character().name}</span>
        </p>
      </div>

      <div class="flex flex-col gap-2.5 text-[22px] text-ink">
        <label class="flex items-center gap-2">
          <span class={OPTION_LABEL}>Name</span>
          <input
            ref={props.nameRef}
            class={`${INPUT} flex-1`}
            value={props.name}
            maxlength={20}
            placeholder="Enter a name"
            aria-invalid={props.nameError ? "true" : undefined}
            aria-describedby={props.nameError ? "name-error" : undefined}
            onInput={e => props.onNameChange(e.currentTarget.value)}
          />
        </label>
        <Show when={props.nameError}>
          {message => (
            <p id="name-error" class="m-0 pl-[100px] text-xl text-red max-sm:pl-0">
              {message()}
            </p>
          )}
        </Show>

        <For each={rows()}>
          {row => (
            <div class="flex items-center gap-2">
              <span class={OPTION_LABEL}>{row.label}</span>
              <button
                type="button"
                class={ARROW}
                aria-label={`Previous ${row.label}`}
                onClick={() => step(row.field, -1)}
              >
                ◀
              </button>
              <span class="min-w-0 flex-1 text-center">{row.names[props.look[row.field]]}</span>
              <button type="button" class={ARROW} aria-label={`Next ${row.label}`} onClick={() => step(row.field, 1)}>
                ▶
              </button>
            </div>
          )}
        </For>

        <label class="flex items-center gap-2">
          <span class={OPTION_LABEL}>Glasses</span>
          <input
            class={INPUT}
            type="checkbox"
            checked={props.look.glasses}
            onChange={e =>
              props.onChange({
                ...props.look,
                glasses: e.currentTarget.checked,
              })
            }
          />
          <span>{props.look.glasses ? "Yes" : "No"}</span>
        </label>
      </div>

      <div class="flex justify-center gap-2">
        <button type="button" class={BTN_SMALL} onClick={() => props.onChange(randomLook(props.look.character))}>
          Randomise
        </button>
        <button
          type="button"
          class={BTN_SMALL}
          onClick={() => props.onChange({ ...DEFAULT_LOOK, character: props.look.character })}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
