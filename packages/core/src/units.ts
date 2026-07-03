export type BrewMethod =
  | "espresso"
  | "v60"
  | "aeropress"
  | "frenchpress"
  | "moka"
  | "auto";

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Snaps a value to the nearest multiple of `step`, then strips binary
 * floating-point noise (e.g. 2.5 - 0.1 steps -> 2.4000000000000004).
 */
export function roundToStep(value: number, step: number): number {
  const snapped = Math.round(value / step) * step;
  return Math.round(snapped * 1e8) / 1e8;
}
