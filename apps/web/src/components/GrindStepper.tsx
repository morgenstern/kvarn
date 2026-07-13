import { ParamStepper } from "@kvarn/ui";
import { formatClickParts, indexToValue, valueToIndex, type ClickScale } from "@kvarn/core";
import type { GrindScaleValue } from "../state/store";

function clickScaleOf(grindScale: GrindScaleValue): ClickScale | null {
  if (grindScale.mainMin === undefined || grindScale.mainMax === undefined || grindScale.subMin === undefined || grindScale.subMax === undefined) {
    return null;
  }
  return { mainMin: grindScale.mainMin, mainMax: grindScale.mainMax, subMin: grindScale.subMin, subMax: grindScale.subMax };
}

/** Renders a plain flat-scale ParamStepper, or — for a two-dial grinder
 * (subclicksEnabled) — an odometer-style stepper that steps by exactly one
 * subclick and displays "main,sub"/"main.sub" depending on locale. See
 * docs/superpowers/specs/2026-07-05-grind-main-subclicks-design.md. */
export function GrindStepper({
  label,
  grindScale,
  value,
  onChange,
  locale,
}: {
  label: string;
  grindScale: GrindScaleValue;
  value: number;
  onChange: (value: number) => void;
  locale: "de" | "en";
}) {
  const clickScale = clickScaleOf(grindScale);

  if (grindScale.subclicksEnabled && clickScale) {
    const totalPositions = (clickScale.mainMax - clickScale.mainMin + 1) * (clickScale.subMax - clickScale.subMin + 1);
    return (
      <ParamStepper
        label={label}
        unit={grindScale.unit}
        value={valueToIndex(value, clickScale)}
        step={1}
        min={0}
        max={totalPositions - 1}
        formatValue={(index) => {
          const { mainClick, subClick } = formatClickParts(indexToValue(index, clickScale), clickScale);
          return `${mainClick}${locale === "de" ? "," : "."}${subClick}`;
        }}
        onChange={(index) => onChange(indexToValue(index, clickScale))}
      />
    );
  }

  return (
    <ParamStepper label={label} unit={grindScale.unit} value={value} step={grindScale.step} min={grindScale.min} max={grindScale.max} onChange={onChange} />
  );
}
