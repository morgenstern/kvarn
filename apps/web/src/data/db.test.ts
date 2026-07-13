import { describe, expect, it, beforeEach } from "vitest";
import { db } from "./db";

describe("Dexie migration to version 2", () => {
  beforeEach(async () => {
    await db.equipment.clear();
  });

  it("backfills subclicksEnabled: false on existing equipment rows that have a grindScale but are missing the field", async () => {
    // Simulate a pre-migration row, written directly (bypassing the app's
    // current TypeScript type, which now requires subclicksEnabled) to
    // model what's actually sitting in a real user's IndexedDB today.
    const legacyRow = {
      id: "equipment_legacy_1",
      userId: "local",
      productId: null,
      customName: null,
      kind: "grinder" as const,
      notes: null,
      burrKg: null,
      grindScale: { min: 0, max: 40, step: 1, unit: "clicks", label: "", finerDirection: -1 as const },
      photoUrl: null,
      imageUrl: null,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      clientId: "client_legacy_1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await db.equipment.put(legacyRow);

    // Re-running the same version's upgrade logic isn't how Dexie works (it
    // only runs once per browser database), so instead we directly assert
    // the invariant the migration is responsible for by checking the schema
    // version is at least 2 and by re-reading the row after Dexie's own
    // open() has run the upgrade chain (which already happened when `db`
    // was constructed at module load, before this test's `put` above — so
    // this test instead verifies the *shape* the upgrade guarantees for any
    // row missing the field, by calling the exported migration function
    // directly).
    const { backfillGrindScaleSubclicks } = await import("./db");
    await backfillGrindScaleSubclicks();

    const migrated = await db.equipment.get("equipment_legacy_1");
    expect(migrated?.grindScale?.subclicksEnabled).toBe(false);
  });

  it("leaves a null grindScale alone", async () => {
    const { backfillGrindScaleSubclicks } = await import("./db");
    await db.equipment.put({
      id: "equipment_no_scale",
      userId: "local",
      productId: null,
      customName: null,
      kind: "machine" as const,
      notes: null,
      burrKg: null,
      grindScale: null,
      photoUrl: null,
      imageUrl: null,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      clientId: "client_no_scale",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    await backfillGrindScaleSubclicks();
    const row = await db.equipment.get("equipment_no_scale");
    expect(row?.grindScale).toBeNull();
  });

  it("leaves an already-migrated row's subclicksEnabled: true alone", async () => {
    const { backfillGrindScaleSubclicks } = await import("./db");
    await db.equipment.put({
      id: "equipment_already_click",
      userId: "local",
      productId: null,
      customName: null,
      kind: "grinder" as const,
      notes: null,
      burrKg: null,
      grindScale: {
        min: 1, max: 4.4, step: 0.01, unit: "clicks", label: "", finerDirection: -1,
        subclicksEnabled: true, mainMin: 1, mainMax: 4, subMin: 0, subMax: 40,
      },
      photoUrl: null,
      imageUrl: null,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      clientId: "client_already_click",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    await backfillGrindScaleSubclicks();
    const row = await db.equipment.get("equipment_already_click");
    expect(row?.grindScale?.subclicksEnabled).toBe(true);
  });
});
