# Manual Brew Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users log a brew that already happened in the past, via a third "Nachtragen" mode on the Brühen screen, walking through setup/bean → params+time+rating in a dedicated step-by-step form, tagged `isManualEntry: true`.

**Architecture:** A new self-contained `ManualBrewEntry` component (its own internal 3-step state machine: setup/bean picker → params+time → rating) rendered by `Bruehen.tsx` when its existing `pickMode` state is `"manual"`. Reuses the live-brew flow's exact UI pieces throughout (`GrindStepper`, `ParamStepper`, `RatingSlider`, `Chip` tags, the rating step JSX) rather than duplicating logic — the only genuinely new pieces are the setup/bean dropdowns, a native datetime picker for `brewedAt`, and a stepper for `timeTotalS` (which a live brew derives from its running timer instead).

**Tech Stack:** React, existing `@kvarn/ui` components, `commitBrew` store action, Drizzle (one new NOT NULL column via `drizzle-kit generate`).

**Spec:** `docs/superpowers/specs/2026-07-05-manual-brew-entry-design.md`

**Depends on:** `docs/superpowers/plans/2026-07-05-grind-main-subclicks.md` Task 9 (this plan's Task 4 imports the `GrindStepper` component that task creates) — run that plan first, or at minimum its Task 9, before this one.

---

## Task 1: Generalize `beanAgeDaysFor` to accept a reference date

**Files:**
- Create: `apps/web/src/utils/beanAge.ts`
- Modify: `apps/web/src/routes/Bruehen.tsx`

The live-brew flow computes bean age relative to "now" (when the timer finishes); a manually-logged brew needs it relative to whatever date the user entered. Both need the same underlying math, so this extracts it into a small shared util before a second caller needs it (matching the same reasoning as extracting `GrindStepper` in the grind-clicks plan) rather than duplicating it.

- [ ] **Step 1: Create the shared helper**

Create `apps/web/src/utils/beanAge.ts`:

```typescript
/**
 * Days since roastDate, relative to `referenceIso` (defaults to now). A live
 * brew calls this with just roastDate (relative to "now"); a manually-logged
 * historical brew passes the date the user entered instead of "now".
 */
export function beanAgeDaysFor(roastDate: string | null, referenceIso: string = new Date().toISOString()): number | null {
  if (!roastDate) return null;
  return Math.max(0, Math.round((new Date(referenceIso).getTime() - new Date(roastDate).getTime()) / 86_400_000));
}
```

- [ ] **Step 2: Remove the local copy from Bruehen.tsx and import the shared one**

Current (`apps/web/src/routes/Bruehen.tsx:19-22`):

```typescript
function beanAgeDaysFor(roastDate: string | null): number | null {
  if (!roastDate) return null;
  return Math.max(0, Math.round((Date.now() - new Date(roastDate).getTime()) / 86_400_000));
}
```

Delete this function entirely. Add an import instead, alongside the other local imports near the top of the file (e.g. next to the `useGrindSuggestion` import):

```typescript
import { beanAgeDaysFor } from "../utils/beanAge";
```

The existing call site in `finish()` (`beanAgeDays: beanAgeDaysFor(bean!.roastDate)`) is unchanged — the new default parameter makes the one-argument call still work exactly as before.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @kvarn/web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/utils/beanAge.ts apps/web/src/routes/Bruehen.tsx
git commit -m "Generalize beanAgeDaysFor to accept a reference date"
```

---

## Task 2: `isManualEntry` schema column

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: (generated) `packages/db/migrations/0006_*.sql`
- Modify: `apps/web/src/routes/Bruehen.tsx` (existing `commitBrew` call site)
- Modify: `apps/web/src/state/store.test.ts` (existing `commitBrew` call sites)

- [ ] **Step 1: Add the column**

Current (`packages/db/src/schema.ts`, inside the `brew` table, right after `isDialIn`):

```typescript
  isDialIn: integer("is_dial_in", { mode: "boolean" }).notNull().default(false),
  recipeId: text("recipe_id").references(() => recipe.id),
```

New:

```typescript
  isDialIn: integer("is_dial_in", { mode: "boolean" }).notNull().default(false),
  // True for a brew logged via "Nachtragen" (manual historical entry) rather
  // than the live timer flow — lets the UI distinguish them later (e.g. a
  // logbook badge) without guessing from other fields like a null weatherId,
  // which a live brew can also have if location permission was denied.
  isManualEntry: integer("is_manual_entry", { mode: "boolean" }).notNull().default(false),
  recipeId: text("recipe_id").references(() => recipe.id),
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm --filter @kvarn/db generate`
Expected: creates a new `packages/db/migrations/0006_<name>.sql` file containing `ALTER TABLE `brew` ADD `is_manual_entry` integer DEFAULT false NOT NULL;` (or equivalent — check the actual generated SQL matches this shape), plus an updated `packages/db/migrations/meta/0006_snapshot.json` and `_journal.json`.

- [ ] **Step 3: Update the live-brew `commitBrew` call site**

In `apps/web/src/routes/Bruehen.tsx`'s `finish()` function, current (`Bruehen.tsx:148-150`):

```typescript
      isDialIn: false,
      recipeId: null,
    });
```

New:

```typescript
      isDialIn: false,
      recipeId: null,
      isManualEntry: false,
    });
```

- [ ] **Step 4: Update the store test's `commitBrew` call sites**

In `apps/web/src/state/store.test.ts`, the "full brew loop" test has a standalone brew object literal — find `isDialIn: false,` followed by `recipeId: null,` (near the end of the `commitBrew({...})` call in the `"full brew loop: equipment -> setup -> bean -> brew"` test) and add `isManualEntry: false,` after it, same as above.

The "upserts one recipe..." test has a shared `baseBrew` object reused across two `commitBrew` calls — same edit, once, in `baseBrew`:

```typescript
      isDialIn: false,
      recipeId: null,
    };
```

becomes:

```typescript
      isDialIn: false,
      recipeId: null,
      isManualEntry: false,
    };
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @kvarn/web test`
Expected: PASS — confirms the schema change didn't break the existing brew-creation flow.

- [ ] **Step 6: Typecheck and lint the whole workspace**

Run: `pnpm -w typecheck && pnpm -w lint`
Expected: PASS. (This specifically catches any other `commitBrew`-shaped object literal this plan's research didn't find — the `Brew` type change makes `isManualEntry` required everywhere a full brew object is constructed, so a missed call site fails typecheck loudly rather than silently.)

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema.ts packages/db/migrations apps/web/src/routes/Bruehen.tsx apps/web/src/state/store.test.ts
git commit -m "Add isManualEntry column to brew"
```

---

## Task 3: i18n strings

**Files:**
- Modify: `apps/web/src/i18n/de.ts`
- Modify: `apps/web/src/i18n/en.ts`

- [ ] **Step 1: Add the new `bruehen` namespace keys**

In `apps/web/src/i18n/de.ts`, current (`de.ts:107-108`):

```typescript
    modeSetup: "Setup wählen",
    modeCombo: "Einzeln wählen",
```

New:

```typescript
    modeSetup: "Setup wählen",
    modeCombo: "Einzeln wählen",
    modeManual: "Nachtragen",
    manualSetupBeanTitle: "Welches Setup, welche Bohne?",
    manualBrewedAt: "Wann gebrüht?",
    manualTimeTotal: "Brühzeit",
    manualTimeUnit: "s",
    next: "Weiter",
```

In `apps/web/src/i18n/en.ts`, current (`en.ts:109-110`):

```typescript
    modeSetup: "Choose setup",
    modeCombo: "Pick individually",
```

New:

```typescript
    modeSetup: "Choose setup",
    modeCombo: "Pick individually",
    modeManual: "Log past brew",
    manualSetupBeanTitle: "Which setup, which bean?",
    manualBrewedAt: "When did you brew this?",
    manualTimeTotal: "Brew time",
    manualTimeUnit: "s",
    next: "Next",
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @kvarn/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/i18n/de.ts apps/web/src/i18n/en.ts
git commit -m "Add i18n strings for manual brew entry"
```

---

## Task 4: `ManualBrewEntry` component

**Files:**
- Create: `apps/web/src/components/ManualBrewEntry.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/ManualBrewEntry.tsx`:

```typescript
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BarChart3, CheckCircle2, Home } from "lucide-react";
import { Button, Card, Chip, ParamStepper, RatingSlider, SectionLabel, Select } from "@kvarn/ui";
import { equipmentGrindScale, useKvarnStore } from "../state/store";
import { useGrindSuggestion } from "../hooks/useGrindSuggestion";
import { useLocale, useT, useTags } from "../i18n";
import { beanAgeDaysFor } from "../utils/beanAge";
import { GrindStepper } from "./GrindStepper";

type ManualStep = "setupBean" | "paramsTime" | "rating";

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Third mode on the Brühen screen ("Nachtragen"/"Log past brew") — logs a
 * brew that already happened, instead of running the live timer. See
 * docs/superpowers/specs/2026-07-05-manual-brew-entry-design.md. */
export function ManualBrewEntry() {
  const state = useKvarnStore();
  const { setups, beans, commitBrew } = state;
  const { locale } = useLocale();
  const t = useT("bruehen");
  const visualTagOptions = useTags("bruehen", "visualTags");
  const flavorTagOptions = useTags("bruehen", "flavorTags");
  const navigate = useNavigate();

  const [manualStep, setManualStep] = useState<ManualStep>("setupBean");
  const [setupId, setSetupId] = useState(setups[0]?.id ?? "");
  const [beanId, setBeanId] = useState(beans[0]?.id ?? "");
  const [brewedAt, setBrewedAt] = useState(() => new Date().toISOString());
  const [doseG, setDoseG] = useState(18);
  const [targetYieldG, setTargetYieldG] = useState(36);
  const [actualYieldG, setActualYieldG] = useState(36);
  const [timeTotalS, setTimeTotalS] = useState(25);
  const [preinfusion, setPreinfusion] = useState(false);
  const [preinfusionS, setPreinfusionS] = useState(5);
  const [ratingTotal, setRatingTotal] = useState(7);
  const [balance, setBalance] = useState(0);
  const [visualTags, setVisualTags] = useState<string[]>([]);
  const [flavorTags, setFlavorTags] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const setup = setups.find((s) => s.id === setupId);
  const bean = beans.find((b) => b.id === beanId);
  const { grindScale, suggestion } = useGrindSuggestion(state, setup, bean, null);
  const [grindSetting, setGrindSetting] = useState(() => suggestion?.grindSetting ?? equipmentGrindScale(state, setup?.grinderEquipmentId ?? null).min);

  function toggleTag(list: string[], setList: (v: string[]) => void, tag: string) {
    setList(list.includes(tag) ? list.filter((x) => x !== tag) : [...list, tag]);
  }

  async function finish() {
    if (!setup || !bean) return;
    await commitBrew({
      setupId: setup.id,
      beanId: bean.id,
      weatherId: null,
      brewedAt,
      grindSetting,
      doseG,
      targetYieldG,
      waterTempC: null,
      preinfusionS: preinfusion ? preinfusionS : null,
      puckPrep: null,
      beanAgeDays: beanAgeDaysFor(bean.roastDate, brewedAt),
      timeTotalS,
      timeFirstDropS: null,
      pressureAvgBar: null,
      pressurePeakBar: null,
      actualYieldG,
      flowGs: timeTotalS > 0 ? Math.round((actualYieldG / timeTotalS) * 10) / 10 : null,
      ratingTotal,
      balance,
      sweetness: null,
      body: null,
      crema: null,
      visualTags,
      flavorTags,
      tdsPct: null,
      note: null,
      photoUrl: null,
      isDialIn: false,
      recipeId: null,
      isManualEntry: true,
    });
    setSaved(true);
  }

  if (saved) {
    return (
      <div>
        <h1 className="flex items-center gap-2 font-display text-[32px] mt-3.5 mb-0.5">
          <CheckCircle2 className="text-sage" size={28} strokeWidth={1.5} />
          {t("savedTitle")}
        </h1>
        <p className="text-base text-muted">{t("savedSubtitle")}</p>
        <Button onClick={() => navigate({ to: "/" })}>
          <Home size={18} strokeWidth={1.5} />
          {t("backToToday")}
        </Button>
        <Button variant="ghost" onClick={() => navigate({ to: "/kompass" })}>
          <BarChart3 size={18} strokeWidth={1.5} />
          {t("viewLog")}
        </Button>
      </div>
    );
  }

  if (manualStep === "setupBean") {
    return (
      <Card>
        <SectionLabel>{t("manualSetupBeanTitle")}</SectionLabel>
        <Select value={setupId} onChange={setSetupId} placeholder={t("modeSetup")} options={setups.map((s) => ({ value: s.id, label: s.name }))} />
        <Select
          value={beanId}
          onChange={setBeanId}
          placeholder={t("pickBean")}
          options={beans.map((b) => ({ value: b.id, label: `${b.roaster} — ${b.name}` }))}
        />
        <Button disabled={!setupId || !beanId} onClick={() => setManualStep("paramsTime")}>
          {t("next")}
        </Button>
      </Card>
    );
  }

  if (manualStep === "paramsTime") {
    return (
      <Card>
        <div className="flex flex-col gap-0.5 py-[13px] border-b border-linen">
          <label className="text-[13px] text-muted">{t("manualBrewedAt")}</label>
          <input
            type="datetime-local"
            value={toDatetimeLocalValue(brewedAt)}
            onChange={(e) => setBrewedAt(new Date(e.target.value).toISOString())}
            className="border border-linen rounded-control px-3 py-2 text-base bg-birch"
          />
        </div>
        <GrindStepper label={grindScale.label || t("grindLabel")} grindScale={grindScale} value={grindSetting} onChange={setGrindSetting} locale={locale} />
        <ParamStepper label={t("doseLabel")} unit={t("doseUnit")} value={doseG} step={0.5} min={1} onChange={setDoseG} />
        <ParamStepper label={t("targetYieldLabel")} unit={t("targetYieldUnit")} value={targetYieldG} step={1} min={1} onChange={setTargetYieldG} />
        <ParamStepper label={t("actualYieldLabel")} unit={t("actualYieldUnit")} value={actualYieldG} step={0.5} min={0} onChange={setActualYieldG} />
        <ParamStepper label={t("manualTimeTotal")} unit={t("manualTimeUnit")} value={timeTotalS} step={1} min={1} onChange={setTimeTotalS} />
        <div className="flex items-center justify-between py-[13px] border-b border-linen last:border-b-0">
          <div className="text-base">{t("preinfusion")}</div>
          <button
            type="button"
            role="switch"
            aria-checked={preinfusion}
            onClick={() => setPreinfusion((v) => !v)}
            className={`w-11 h-6 rounded-full relative transition-colors ${preinfusion ? "bg-copper" : "bg-linen"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${preinfusion ? "translate-x-5" : ""}`} />
          </button>
        </div>
        {preinfusion ? (
          <ParamStepper label={t("preinfusionDuration")} unit={t("preinfusionUnit")} value={preinfusionS} step={1} min={1} onChange={setPreinfusionS} />
        ) : null}
        <Button onClick={() => setManualStep("rating")}>{t("next")}</Button>
      </Card>
    );
  }

  return (
    <Card>
      <RatingSlider label={t("overall")} value={ratingTotal} min={1} max={10} onChange={setRatingTotal} />
      <RatingSlider label={t("balance")} value={balance} min={-5} max={5} onChange={setBalance} bipolarLabels={[t("sour"), t("bitter")]} />
      <div className="mt-3">
        <div className="text-sm text-muted mb-2">{t("visual")}</div>
        <div className="flex flex-wrap gap-2">
          {visualTagOptions.map((tag) => (
            <Chip key={tag} active={visualTags.includes(tag)} onClick={() => toggleTag(visualTags, setVisualTags, tag)}>
              {tag}
            </Chip>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <div className="text-sm text-muted mb-2">{t("aroma")}</div>
        <div className="flex flex-wrap gap-2">
          {flavorTagOptions.map((tag) => (
            <Chip key={tag} active={flavorTags.includes(tag)} onClick={() => toggleTag(flavorTags, setFlavorTags, tag)}>
              {tag}
            </Chip>
          ))}
        </div>
      </div>
      <Button onClick={finish}>{t("save")}</Button>
    </Card>
  );
}
```

Note on the grind default: `useGrindSuggestion(state, setup, bean, null)` is the exact same hook the live-brew flow uses, called with `null` weather (matching the design decision that manual entries never have weather) — this gives a real Compass-informed default (based on this setup+bean's last brew, if any) rather than a naive midpoint, for free.

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck && pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ManualBrewEntry.tsx
git commit -m "Add ManualBrewEntry step-by-step form"
```

---

## Task 5: Wire the "Nachtragen" mode into Bruehen.tsx

**Files:**
- Modify: `apps/web/src/routes/Bruehen.tsx`

- [ ] **Step 1: Read the current file in full to confirm it matches**

Run: `cat apps/web/src/routes/Bruehen.tsx`

Confirm the `pickMode`-gated JSX block still matches the structure below (it may have shifted slightly from Task 1's and the grind-clicks plan's earlier edits — use the actual current content for exact line targeting, not the line numbers quoted here).

- [ ] **Step 2: Add the type and import**

Current:

```typescript
type PickMode = "setup" | "combo";
```

New:

```typescript
type PickMode = "setup" | "combo" | "manual";
```

Add the import, alongside the other component imports:

```typescript
import { ManualBrewEntry } from "../components/ManualBrewEntry";
```

- [ ] **Step 3: Add the third Chip**

Current:

```tsx
          <div className="flex gap-2 mt-5">
            <Chip active={pickMode === "setup"} onClick={() => setPickMode("setup")}>
              {t("modeSetup")}
            </Chip>
            <Chip active={pickMode === "combo"} onClick={startCombo}>
              {t("modeCombo")}
            </Chip>
          </div>
```

New:

```tsx
          <div className="flex gap-2 mt-5">
            <Chip active={pickMode === "setup"} onClick={() => setPickMode("setup")}>
              {t("modeSetup")}
            </Chip>
            <Chip active={pickMode === "combo"} onClick={startCombo}>
              {t("modeCombo")}
            </Chip>
            <Chip active={pickMode === "manual"} onClick={() => setPickMode("manual")}>
              {t("modeManual")}
            </Chip>
          </div>
```

- [ ] **Step 4: Skip the setup/combo picker JSX and the live params card when in manual mode**

The existing combo-vs-setup builder is gated by `pickMode === "setup" ? A : B` (a 2-way ternary) in two places, and the grind/dose/yield `<Card>` is gated only by `step === "params"`. Change both to account for the new third state — manual mode renders nothing in these spots (it has its own picker and its own params inside `ManualBrewEntry`), and instead renders `<ManualBrewEntry />` once, right after the mode-switch Chips.

Current (the combo-builder ternary):

```tsx
          {pickMode === "setup" ? (
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 mt-3">
              {setups.map((s) => (
```

Change the opening condition to a 3-way check — replace `pickMode === "setup" ? (` with `pickMode === "setup" ? (` for the setup-list branch (unchanged), but change its closing `) : (` — i.e. find the full ternary spanning from this setup-list JSX through the combo-builder JSX (ending at the `confirmCombo` button and its closing `)}`), and change the final `) : (` that separates the two branches into a 3-way form. Concretely, the existing full ternary is:

```tsx
          {pickMode === "setup" ? (
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 mt-3">
              {/* ...setup cards... */}
            </div>
          ) : (
            <>
              {/* ...combo builder: method chips, grinder cards, machine cards, bean cards, confirm button... */}
            </>
          )}
```

New:

```tsx
          {pickMode === "setup" ? (
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 mt-3">
              {/* ...setup cards, unchanged... */}
            </div>
          ) : pickMode === "combo" ? (
            <>
              {/* ...combo builder, unchanged... */}
            </>
          ) : null}
```

(i.e. add `pickMode === "combo" ? (` before the existing combo-builder fragment's `<>`, and change the final `)}` to `) : null}` — the JSX contents inside each branch are untouched, only the condition guarding the second branch and the addition of a third `: null` case.)

Similarly, the trailing bean-picker block that's also gated by `pickMode === "setup"`:

```tsx
          {pickMode === "setup" ? (
            <>
              <SectionLabel icon={Package} className="mt-5">{t("pickBean")}</SectionLabel>
              {/* ...bean cards... */}
            </>
          ) : null}
```

This one is already a 2-way `? ... : null` — it needs **no change**, since it's already correctly false for both `"combo"` and `"manual"`.

- [ ] **Step 5: Render `ManualBrewEntry` and gate the live params Card**

Immediately after the closing of the ternary from Step 4 (the one that now ends `) : null}` for the setup/combo builder), add:

```tsx
          {pickMode === "manual" ? <ManualBrewEntry /> : null}
```

Then find the grind/dose/yield Card, currently gated only by `step === "params"`:

```tsx
      {step === "params" ? (
        <Card>
          <GrindStepper
```

Change to:

```tsx
      {step === "params" && pickMode !== "manual" ? (
        <Card>
          <GrindStepper
```

(This assumes the grind-clicks plan's Task 9 has already landed, replacing the old `<ParamStepper>` grind block with `<GrindStepper>` — if executing this plan before that one, adjust to match whatever the grind stepper's current opening tag actually is.)

- [ ] **Step 6: Typecheck and lint**

Run: `pnpm --filter @kvarn/web typecheck && pnpm --filter @kvarn/web lint`
Expected: PASS.

- [ ] **Step 7: Manual verification in the browser**

Using the preview tooling already set up for this project:
1. Go to Brühen, confirm a third "Nachtragen" Chip appears alongside "Setup wählen" / "Einzeln wählen".
2. Tap it — confirm the setup/bean picker and the live grind/dose/yield card both disappear, replaced by the manual-entry form's first step (setup + bean dropdowns).
3. Pick a setup and bean, advance — confirm the params+time step shows grind (with `GrindStepper`, correctly odometer-style if this setup's grinder has subclicks enabled), dose, target yield, actual yield, brew time, and the pre-infusion toggle.
4. Change the "Wann gebrüht?" date to yesterday, advance to the rating step, save.
5. Confirm the save succeeds (saved confirmation screen appears) and the brew shows up in Kompass's logbook with the date you entered, not today's date.
6. Switch back to "Setup wählen" — confirm the live timer flow still works exactly as before.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/routes/Bruehen.tsx
git commit -m "Wire the Nachtragen manual-entry mode into Bruehen"
```

---

## Task 6: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full workspace check**

Run: `pnpm -w lint && pnpm -w typecheck && pnpm -w test`
Expected: PASS across all 6 packages.

- [ ] **Step 2: Add a release note entry**

Check the current commit count with `git rev-list --count HEAD`, add 1, and add an entry to `apps/web/src/releaseNotes.ts` at that version describing this feature briefly in both `de` and `en`.

- [ ] **Step 3: Commit and push**

```bash
git add apps/web/src/releaseNotes.ts
git commit -m "Add release note for manual brew entry"
git push origin main
```
