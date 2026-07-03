import { round1 } from "./units";

export interface RatioInput {
  doseG: number;
  yieldG: number;
}

/** Brew ratio expressed as 1:x, e.g. dose 18g / yield 36g -> 2 */
export function computeRatio({ doseG, yieldG }: RatioInput): number {
  if (doseG <= 0) throw new Error("doseG must be > 0");
  return round1(yieldG / doseG);
}

/** g/s flow rate from actual yield and total brew time */
export function computeFlowRate(yieldG: number, timeTotalS: number): number {
  if (timeTotalS <= 0) return 0;
  return round1(yieldG / timeTotalS);
}

/** Days between roast date and brew date (bean age) */
export function computeBeanAgeDays(roastDate: Date, brewedAt: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.round((brewedAt.getTime() - roastDate.getTime()) / msPerDay));
}
