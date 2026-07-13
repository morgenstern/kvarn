# Manual (historical) brew entry

Status: Approved, ready for implementation plan.

## Problem

Brewing today only happens live, via a running timer in `Bruehen.tsx`. Users need a way to log a brew that already happened in the past (e.g. "I brewed this yesterday").

## Entry point

A third `Chip` option, "Nachtragen" / "Log past brew", added to the existing mode-switch row on the Brühen screen (today: "Setup wählen" / "Einzeln wählen"). No new UI paradigm — the app has no kebab/context-menu pattern anywhere yet, and this reuses the one mode-switch pattern that already exists.

## Steps

### 1. Setup & Bohne

Two `Select` dropdowns: pick an existing Setup, pick an existing Bean. Not a full grinder/machine combo builder (that's what "Einzeln wählen" is for) — if the user needs a setup/bean that doesn't exist yet, they create it in Setup/Regal first, then come back to log the historical brew.

### 2. Wann & Parameter

- `brewedAt`: native `<input type="datetime-local">`, defaults to now, editable to any past date/time.
- `grindSetting`, `doseG`, `targetYieldG`, `actualYieldG`, pre-infusion toggle + duration: identical `ParamStepper` wiring to the live flow — reused, not duplicated, so this automatically inherits main/sub-click grind support once that feature ships.
- `timeTotalS`: new field, not present in the live flow (which derives it from the running timer). A `ParamStepper` with unit "s", defaulting to 25s.

### 3. Bewertung

Reuses the existing rating step exactly as-is: overall `RatingSlider` (1–10), balance bipolar `RatingSlider` (-5..+5, sour/bitter), visual tag `Chip` multi-select, flavor tag `Chip` multi-select.

### Save

Same `commitBrew` call shape as a live brew (`finish()` in `Bruehen.tsx`), with these differences:
- `brewedAt` and `timeTotalS` come from the form instead of `new Date().toISOString()` / the stopwatch.
- `weatherId` is always `null` (no retroactive geolocation/weather).
- `beanAgeDays` is computed relative to the chosen `brewedAt`, not "now".
- `isManualEntry: true` (new column, see below).

## Schema change

Add `isManualEntry: integer("is_manual_entry", { mode: "boolean" }).notNull().default(false)` to the `brew` table — mirrors the existing `isDialIn` column exactly. Needs a standard Drizzle migration (new NOT NULL column with a default), same shape as migration 0005 which added `grind_scale` to `equipment`.

No Dexie-side migration needed: on existing local rows, a missing `isManualEntry` field is semantically correct as `false` (every brew logged before this feature shipped really was a live brew) — a `?? false` fallback at read sites is sufficient, no backfill required.

## Out of scope

- No inline setup/bean creation from this flow.
- No manual weather entry — `weatherId` stays null for all manually-logged brews, same as a live brew with location permission denied. Downstream code (Compass, Kompass's humidity chart) already tolerates missing weather.
- No capture of `waterTempC`, `timeFirstDropS`, pressure, or TDS — none of these are captured by the live flow either, so this is parity, not a new gap.
- No UI badge for manually-logged brews in this pass — `isManualEntry` is added so that's possible later, but rendering it is not part of this feature.
