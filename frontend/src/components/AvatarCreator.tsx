import { For } from "solid-js";
import {
  ACCENTS,
  BODIES,
  DEFAULT_LOOK,
  HAIR_COLORS,
  HAIR_STYLES,
  HAT_NAMES,
  type Look,
  OUTFIT_NAMES,
  randomLook,
  SKINS,
} from "../avatar/look";
import { Avatar } from "./Avatar";

type Field = "body" | "skin" | "hairColor" | "hairStyle" | "outfit" | "accent" | "hat";

interface Row {
  field: Field;
  label: string;
  names: string[];
}

const ROWS: Row[] = [
  { field: "body", label: "Body", names: BODIES },
  { field: "skin", label: "Skin", names: SKINS.map(s => s.name) },
  { field: "hairColor", label: "Hair", names: HAIR_COLORS.map(c => c.name) },
  { field: "hairStyle", label: "Style", names: HAIR_STYLES },
  { field: "hat", label: "Headwear", names: HAT_NAMES },
  { field: "outfit", label: "Outfit", names: OUTFIT_NAMES },
  { field: "accent", label: "Colour", names: ACCENTS.map(a => a.name) },
];

export function AvatarCreator(props: { look: Look; onChange: (look: Look) => void }) {
  const step = (field: Field, delta: number) => {
    const count = ROWS.find(r => r.field === field)!.names.length;
    const next = (props.look[field] + delta + count) % count;
    props.onChange({ ...props.look, [field]: next });
  };

  return (
    <div class="creator">
      <div class="creator-preview">
        <div class="creator-stage">
          <Avatar look={props.look} size={128} />
        </div>
        <div class="creator-actions">
          <button class="btn btn-small" onClick={() => props.onChange(randomLook())}>
            Randomise
          </button>
          <button class="btn btn-small" onClick={() => props.onChange({ ...DEFAULT_LOOK })}>
            Reset
          </button>
        </div>
      </div>

      <div class="creator-options">
        <For each={ROWS}>
          {row => (
            <div class="option-row">
              <span class="option-label">{row.label}</span>
              <button class="arrow" aria-label={`Previous ${row.label}`} onClick={() => step(row.field, -1)}>
                ◀
              </button>
              <span class="option-value">{row.names[props.look[row.field]]}</span>
              <button class="arrow" aria-label={`Next ${row.label}`} onClick={() => step(row.field, 1)}>
                ▶
              </button>
            </div>
          )}
        </For>
        <label class="option-row">
          <span class="option-label">Glasses</span>
          <input
            type="checkbox"
            checked={props.look.glasses}
            onChange={e => props.onChange({ ...props.look, glasses: e.currentTarget.checked })}
          />
          <span class="option-value">{props.look.glasses ? "Yes" : "No"}</span>
        </label>
      </div>
    </div>
  );
}
