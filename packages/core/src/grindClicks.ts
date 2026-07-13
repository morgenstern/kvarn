/**
 * Conversions between the three representations of a two-dial "main
 * click + subclick" grind position (e.g. Kingrinder K6: main 1-4, sub
 * 0-40) — see docs/superpowers/specs/2026-07-05-grind-main-subclicks-design.md.
 *
 * - {mainClick, subClick}: what a person actually sets on the grinder.
 * - encoded float: what's stored in brew.grindSetting, e.g. 1.25.
 * - absolute index: a 0-based, uniform-step-of-1 flattening of the whole
 *   scale, used for all step/clamp arithmetic (the brewing-screen stepper
 *   and Compass's suggestion math) so rollover between main clicks falls
 *   out for free instead of needing boundary-case logic.
 */

export interface ClickScale {
  mainMin: number;
  mainMax: number;
  subMin: number;
  subMax: number;
}

/** Decimal digits needed to encode subMax unambiguously (40 -> 2, 150 -> 3). */
export function subDigits(scale: ClickScale): number {
  return String(scale.subMax).length;
}

export function subDivisor(scale: ClickScale): number {
  return 10 ** subDigits(scale);
}

/** mainClick + subClick/divisor, rounded to strip binary floating-point noise. */
export function encodeClickValue(mainClick: number, subClick: number, scale: ClickScale): number {
  const divisor = subDivisor(scale);
  return Math.round((mainClick + subClick / divisor) * divisor) / divisor;
}

/** Inverse of encodeClickValue. */
export function decodeClickValue(value: number, scale: ClickScale): { mainClick: number; subClick: number } {
  const divisor = subDivisor(scale);
  const mainClick = Math.floor(value + 1e-9);
  const subClick = Math.round((value - mainClick) * divisor);
  return { mainClick, subClick };
}

function subRange(scale: ClickScale): number {
  return scale.subMax - scale.subMin + 1;
}

/** Total number of valid (mainClick, subClick) positions across the whole scale. */
export function totalPositions(scale: ClickScale): number {
  return (scale.mainMax - scale.mainMin + 1) * subRange(scale);
}

/** (mainClick, subClick) -> a single absolute step count, 0 at (mainMin, subMin). */
export function toAbsoluteIndex(mainClick: number, subClick: number, scale: ClickScale): number {
  return (mainClick - scale.mainMin) * subRange(scale) + (subClick - scale.subMin);
}

/** Inverse of toAbsoluteIndex. Precondition: 0 <= index <= totalPositions(scale) - 1. */
export function fromAbsoluteIndex(index: number, scale: ClickScale): { mainClick: number; subClick: number } {
  const range = subRange(scale);
  const mainClick = scale.mainMin + Math.floor(index / range);
  const subClick = scale.subMin + (index % range);
  return { mainClick, subClick };
}

/** Encoded float -> absolute index, in one step. */
export function valueToIndex(value: number, scale: ClickScale): number {
  const { mainClick, subClick } = decodeClickValue(value, scale);
  return toAbsoluteIndex(mainClick, subClick, scale);
}

/** Absolute index -> encoded float, in one step. */
export function indexToValue(index: number, scale: ClickScale): number {
  const { mainClick, subClick } = fromAbsoluteIndex(index, scale);
  return encodeClickValue(mainClick, subClick, scale);
}

/** Locale-agnostic display parts. subClick is zero-padded to the scale's
 * digit width (e.g. sub=5 on a 0-40 scale -> "05") so the decimal separator
 * always means the same thing regardless of value — callers join these with
 * a locale-appropriate separator ("," for de, "." for en). */
export function formatClickParts(value: number, scale: ClickScale): { mainClick: number; subClick: string } {
  const { mainClick, subClick } = decodeClickValue(value, scale);
  return { mainClick, subClick: String(subClick).padStart(subDigits(scale), "0") };
}
