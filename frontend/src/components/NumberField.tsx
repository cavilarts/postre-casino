import { createSignal } from "solid-js";
import { INPUT } from "../ui";

interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}

/**
 * Labelled numeric input that reports its value as a number. While the field
 * is being edited it shows exactly what was typed, so clearing it leaves it
 * empty instead of writing "0" back; it shows the stored value again on blur.
 */
export function NumberField(props: NumberFieldProps) {
  const [draft, setDraft] = createSignal<string | null>(null);

  return (
    <label class="flex flex-col gap-1 text-[#6b5232]">
      <span>{props.label}</span>
      <input
        class={INPUT}
        type="number"
        min={props.min}
        value={draft() ?? String(props.value)}
        onInput={e => {
          const raw = e.currentTarget.value;
          setDraft(raw);
          props.onChange(raw === "" ? 0 : Number(raw));
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}
