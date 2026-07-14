import type { BrewMethod } from "./units";

export type MachineMethodHint = "espresso" | "v60" | "aeropress" | "frenchpress" | "moka";
export type BeanType = "espresso" | "filter";

/**
 * Replaces the old explicit method dropdown (setup.method): the machine's
 * own methodHint wins if set (a Rancilio is always "espresso", an Aeropress
 * is always "aeropress"); otherwise the bean's type picks a sensible bucket
 * ("filter" beans default to the "v60" target-time profile, the most
 * generic non-espresso method); if neither is known, espresso — see
 * docs/superpowers/specs/2026-07-14-remove-setup-concept-design.md §2.
 */
export function deriveBrewMethod(
  beanType: BeanType | null | undefined,
  machineMethodHint: MachineMethodHint | null | undefined,
): BrewMethod {
  if (machineMethodHint) return machineMethodHint;
  if (beanType === "espresso") return "espresso";
  if (beanType === "filter") return "v60";
  return "espresso";
}
