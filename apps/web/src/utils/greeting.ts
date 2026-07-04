/**
 * A small Swedish-flavored brand touch (KVARN = "mill/quern" in Swedish) —
 * time-of-day greeting word, independent of the app's DE/EN UI language.
 */
export function greetingWord(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return "God morgon";
  if (hour >= 11 && hour < 17) return "Hej";
  if (hour >= 17 && hour < 23) return "God kväll";
  return "God natt";
}
