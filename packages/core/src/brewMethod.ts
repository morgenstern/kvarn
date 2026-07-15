import type { BrewMethod } from "./units";

// A physical machine's hint can never be "auto" — that's a UI-only
// placeholder for "not yet decided," not a real brew method — so this is
// BrewMethod minus that one member, derived rather than hand-listed to stay
// in sync if BrewMethod ever grows a new method.
export type MachineMethodHint = Exclude<BrewMethod, "auto">;
export type BeanType = "espresso" | "filter";

// Runtime values for MachineMethodHint — types have no runtime
// representation, so pickers/selects that need to enumerate the options
// import this instead of hand-listing the literals a second time.
export const MACHINE_METHOD_HINTS: MachineMethodHint[] = ["espresso", "v60", "aeropress", "frenchpress", "moka"];

/**
 * Replaces the old explicit method dropdown (setup.method): the machine's
 * own methodHint wins if set (a Rancilio is always "espresso", an Aeropress
 * is always "aeropress"); otherwise the bean's type picks a sensible bucket
 * ("filter" beans default to the "v60" target-time profile, the most
 * generic non-espresso method); if neither is known, espresso — see
 * docs/superpowers/specs/2026-07-14-remove-setup-concept-design.md §2.
 * Takes the two derived primitives rather than full Bean/Equipment objects
 * so this package stays decoupled from the app's DB schema.
 */
export function deriveBrewMethod(
  beanType: BeanType | null | undefined,
  machineMethodHint: MachineMethodHint | null | undefined,
): BrewMethod {
  if (machineMethodHint != null) return machineMethodHint;
  if (beanType === "espresso") return "espresso";
  if (beanType === "filter") return "v60";
  return "espresso";
}
