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
