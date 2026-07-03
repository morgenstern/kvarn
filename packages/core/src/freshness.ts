/**
 * Rough freshness curve: peak days 4-21 after roast, tapering off by day 45.
 * See docs/02_UX_KONZEPT.md — bean age is the strongest drift factor besides
 * weather. This is a simple prior, not personalized (that's Kompass Phase 2/3).
 */
export function freshnessPct(daysSinceRoast: number): number {
  if (daysSinceRoast < 0) return 0;
  if (daysSinceRoast <= 21) return 100;
  const decay = Math.max(0, 100 - ((daysSinceRoast - 21) / 24) * 100);
  return Math.round(decay);
}

/** Day range considered peak freshness — used to shade the "target corridor" in charts. */
export const FRESHNESS_PEAK_WINDOW_DAYS: [number, number] = [4, 21];
