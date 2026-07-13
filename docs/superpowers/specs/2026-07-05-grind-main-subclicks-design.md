# Grind main-click + subclick support

Status: Approved, ready for implementation plan.

## Problem

Some grinders (e.g. Kingrinder K6) have two adjustment dials instead of one flat scale: a coarse "main click" (1–4 on the Kingrinder) and, within each main click, a fine "subclick" ring (0–40 on the Kingrinder). The current `grindScale` model (`min`, `max`, `step`, `unit`, `label`, `finerDirection`) only supports a single flat dial and can't represent this.

## Data model

### `GrindScaleJson` (packages/db/src/schema.ts), mirrored in `packages/core`'s `GrindScale`

Add four optional fields and one boolean, keeping every existing field unchanged (flat-scale grinders are untouched):

```ts
type GrindScaleJson = {
  min: number;
  max: number;
  step: number;
  unit: string;
  label: string;
  finerDirection: -1 | 1;
  /** When true, min/max/step above are ignored for editing/display purposes
   * and the four fields below define the two-dial scale instead. */
  subclicksEnabled: boolean;
  mainMin?: number;
  mainMax?: number;
  subMin?: number;
  subMax?: number;
} | null;
```

No separate `step` for main/sub — clicks are always integer increments of 1 on each dial.

### Stored value format

`brews.grindSetting` stays exactly what it is today: a plain `real` column, one float. No schema change to the brews table, no historical data transformation.

When `subclicksEnabled`, the float encodes `mainClick + subClick / divisor`, where `divisor = 10 ^ digits(subMax)` (e.g. subMax=40 → 2 digits → divisor 100; subMax=150 → 3 digits → divisor 1000). This is derived at read/write time from the grinder's own `subMax` — no extra field needed to record the digit width.

- Encode: `value = round(mainClick + subClick / divisor, divisor)` (round to kill float noise)
- Decode: `mainClick = floor(value)`, `subClick = round((value - mainClick) * divisor)`

Example (Kingrinder, subMax=40 → 2 digits): main=1, sub=25 → `1.25`. A hypothetical subMax=150 grinder (3 digits): main=2, sub=5 → `2.005`.

Display formatting joins `mainClick` and zero-padded `subClick` with a locale-appropriate separator (comma for `de`, period for `en`) — done in the web layer, not in `packages/core` (core stays locale-agnostic, returns `{ mainClick, subClick: paddedString }`).

## Rollover math (shared helpers, `packages/core/src/grindClicks.ts`)

Both the brewing-screen stepper and Compass suggestions need to move by exactly one subclick at a time without ever landing on an invalid position (e.g. main=1 sub=41 doesn't exist if subMax=40 for that main click). Shared pure functions:

- `toAbsoluteIndex(mainClick, subClick, scale)` = `(mainClick - mainMin) * subRange + (subClick - subMin)`, where `subRange = subMax - subMin + 1`
- `fromAbsoluteIndex(index, scale)` — inverse
- `totalPositions(scale)` = `(mainMax - mainMin + 1) * subRange`
- `valueToIndex(value, scale)` / `indexToValue(index, scale)` — compose the above with encode/decode

All step/clamp arithmetic (dragging the stepper, Compass's delta calculation) happens in absolute-index space (uniform step size of 1), then converts to the encoded float only at the storage/display boundary. This is what makes rollover between main clicks fall out naturally instead of needing special-cased boundary logic.

## UI changes

### Setup.tsx equipment editor (grinder kind only)

Add a toggle above `GrindScaleFields`: "Unterklicks aktivieren" / "Enable subclicks". Default off.

- Off: today's 3-field min/max/step UI, byte-for-byte unchanged.
- On: 4 fields instead — Hauptklick min/max, Unterklick min/max. (`GrindScaleFields` gains this second mode; same component, not a new file.)

Onboarding's post-add grind-scale confirm popup reuses `GrindScaleFields` already, so it inherits this for free.

### Bruehen.tsx grind control

When the active setup's grinder has `subclicksEnabled`, feed the existing `ParamStepper` (unmodified, already supports a `formatValue` prop) with:
- `value = valueToIndex(grindSetting, scale)`
- `min = 0`, `max = totalPositions(scale) - 1`, `step = 1`
- `formatValue = (idx) => format "main,sub"` (locale-aware separator)
- `onChange = (idx) => setGrindSetting(indexToValue(idx, scale))`

No new stepper component. Dragging past a main click's subclick max/min rolls over to the next/previous main click, sub reset to its own min/max — this is the "odometer" behavior, and it comes from the absolute-index space directly.

### Compass (`packages/core/src/compass.ts`)

`nextGrindSuggestion` gains an `subclicksEnabled` branch: convert `lastBrew.grindSetting` to an absolute index via `valueToIndex`, apply the existing step-count delta directly in index space (each unit = one subclick, uniformly — no more multiplying by a `step` float), clamp to `[0, totalPositions-1]`, convert back via `indexToValue`. The flat-scale branch (today's logic) is untouched.

### Display (Kompass logbook, recipe lines, etc.)

Wherever `grindSetting` is currently interpolated raw (`{grind}` in i18n strings), add a small formatter that checks the relevant equipment's `grindScale.subclicksEnabled` and renders `"1,25"`-style text instead of the raw float when true. Flat-scale display is unchanged.

## Migration

Two independent, already-idiomatic mechanisms — no new infrastructure:

1. **Product catalog default for Kingrinder K6**: edit its entry in `public/data/seed-products.json` to `subclicksEnabled: true, mainMin: 1, mainMax: 4, subMin: 0, subMax: 40`, and bump `SEED_CATALOG_VERSION` in `apps/web/src/data/db.ts`. The existing `ensureSeeded()` re-sync (idempotent `bulkPut`) picks this up for every existing install automatically, same as any other catalog update.
2. **Per-user equipment overrides**: Dexie has been at `version(1)` with no upgrade callbacks so far. Add `version(2)` with an `.upgrade()` transaction that walks the `equipment` table and sets `subclicksEnabled: false` on any row whose `grindScale` is non-null and missing the field. Runs once automatically on next app load for every existing install. `mainMin`/`mainMax`/`subMin`/`subMax` are left `undefined` while disabled — they're simply unused.

No D1/worker-side migration needed: `grindScale` is a schemaless JSON blob there, and all read paths already fall back to `subclicksEnabled: false` when the field is absent, so old synced rows behave correctly without a backfill.

## Terminology (i18n)

- German: "Hauptklick" (main click), "Unterklick" (subclick)
- English: "Main click", "Subclick"

## Out of scope

- No change to `brews`/`recipes` schema.
- No retroactive reformatting of historical brew records (they stay flat floats, correctly, since their equipment defaults to `subclicksEnabled: false`).
- No change to drag-sensitivity tuning in `ParamStepper` — the absolute-index range for a typical two-dial grinder (e.g. 164 positions for the Kingrinder) is in the same order of magnitude as existing single-dial ranges, so existing tuning is assumed to carry over; revisit only if it feels off in testing.
