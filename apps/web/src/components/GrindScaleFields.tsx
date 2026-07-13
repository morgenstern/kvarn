import type { GrindScaleValue } from "../state/store";
import { useT } from "../i18n";

const DEFAULT_SUBCLICK_RANGE = { mainMin: 1, mainMax: 4, subMin: 0, subMax: 40 };

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[13px] text-muted">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 border border-linen rounded-control px-2 py-2 text-base bg-birch"
      />
    </div>
  );
}

/** Flat scale: min/max/step. Two-dial scale (subclicksEnabled): main click
 * min/max + subclick min/max, each an integer-step-of-1 dial — see
 * docs/superpowers/specs/2026-07-05-grind-main-subclicks-design.md. unit,
 * label, and finerDirection are preserved from whatever `value` already has
 * in both modes. */
export function GrindScaleFields({ value, onChange }: { value: GrindScaleValue; onChange: (next: GrindScaleValue) => void }) {
  const t = useT("setup");
  const subclicksEnabled = value.subclicksEnabled ?? false;

  return (
    <div>
      <div className="flex items-center justify-between py-[13px] border-b border-linen">
        <div className="text-base">{t("subclicksEnabled")}</div>
        <button
          type="button"
          role="switch"
          aria-checked={subclicksEnabled}
          onClick={() =>
            onChange({
              ...value,
              subclicksEnabled: !subclicksEnabled,
              mainMin: value.mainMin ?? DEFAULT_SUBCLICK_RANGE.mainMin,
              mainMax: value.mainMax ?? DEFAULT_SUBCLICK_RANGE.mainMax,
              subMin: value.subMin ?? DEFAULT_SUBCLICK_RANGE.subMin,
              subMax: value.subMax ?? DEFAULT_SUBCLICK_RANGE.subMax,
            })
          }
          className={`w-11 h-6 rounded-full relative transition-colors ${subclicksEnabled ? "bg-copper" : "bg-linen"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${subclicksEnabled ? "translate-x-5" : ""}`}
          />
        </button>
      </div>
      {subclicksEnabled ? (
        <div className="flex items-center gap-3 pt-3 flex-wrap">
          <NumberField label={t("mainClickMin")} value={value.mainMin ?? DEFAULT_SUBCLICK_RANGE.mainMin} onChange={(v) => onChange({ ...value, mainMin: v })} />
          <NumberField label={t("mainClickMax")} value={value.mainMax ?? DEFAULT_SUBCLICK_RANGE.mainMax} onChange={(v) => onChange({ ...value, mainMax: v })} />
          <NumberField label={t("subClickMin")} value={value.subMin ?? DEFAULT_SUBCLICK_RANGE.subMin} onChange={(v) => onChange({ ...value, subMin: v })} />
          <NumberField label={t("subClickMax")} value={value.subMax ?? DEFAULT_SUBCLICK_RANGE.subMax} onChange={(v) => onChange({ ...value, subMax: v })} />
        </div>
      ) : (
        <div className="flex items-center gap-3 pt-3">
          <NumberField label={t("grindMin")} value={value.min} onChange={(v) => onChange({ ...value, min: v })} />
          <NumberField label={t("grindMax")} value={value.max} onChange={(v) => onChange({ ...value, max: v })} />
          <NumberField label={t("grindStep")} value={value.step} onChange={(v) => onChange({ ...value, step: v })} />
        </div>
      )}
    </div>
  );
}
