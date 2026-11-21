import { INPUT } from "../ui";

interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}

/** Labelled numeric input that reports its value as a number. */
export function NumberField(props: NumberFieldProps) {
  return (
    <label class="flex flex-col gap-1 text-[#6b5232]">
      <span>{props.label}</span>
      <input
        class={INPUT}
        type="number"
        min={props.min}
        value={props.value}
        onInput={e => props.onChange(Number(e.currentTarget.value))}
      />
    </label>
  );
}
