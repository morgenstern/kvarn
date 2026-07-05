import type { GrindScaleValue } from "../state/store";
import { useT } from "../i18n";

/** The three fields a grind scale boils down to for editing purposes — unit,
 * label, and finerDirection are preserved from whatever `value` already has. */
export function GrindScaleFields({ value, onChange }: { value: GrindScaleValue; onChange: (next: GrindScaleValue) => void }) {
  const t = useT("setup");
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col gap-0.5">
        <label className="text-[13px] text-muted">{t("grindMin")}</label>
        <input
          type="number"
          value={value.min}
          onChange={(e) => onChange({ ...value, min: Number(e.target.value) })}
          className="w-20 border border-linen rounded-control px-2 py-2 text-base bg-birch"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <label className="text-[13px] text-muted">{t("grindMax")}</label>
        <input
          type="number"
          value={value.max}
          onChange={(e) => onChange({ ...value, max: Number(e.target.value) })}
          className="w-20 border border-linen rounded-control px-2 py-2 text-base bg-birch"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <label className="text-[13px] text-muted">{t("grindStep")}</label>
        <input
          type="number"
          step="0.1"
          value={value.step}
          onChange={(e) => onChange({ ...value, step: Number(e.target.value) })}
          className="w-20 border border-linen rounded-control px-2 py-2 text-base bg-birch"
        />
      </div>
    </div>
  );
}
