/**
 * Days since roastDate, relative to `referenceIso` (defaults to now). A live
 * brew calls this with just roastDate (relative to "now"); a manually-logged
 * historical brew passes the date the user entered instead of "now".
 */
export function beanAgeDaysFor(roastDate: string | null, referenceIso: string = new Date().toISOString()): number | null {
  if (!roastDate) return null;
  return Math.max(0, Math.round((new Date(referenceIso).getTime() - new Date(roastDate).getTime()) / 86_400_000));
}
