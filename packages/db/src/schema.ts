import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Single Drizzle schema, SQLite dialect, shared by:
 * - the local database in apps/web (source of truth on-device)
 * - Cloudflare D1 in apps/worker
 * See docs/03_TECH_KONZEPT.md §5.
 *
 * Sync columns on every table: updatedAt, deletedAt (soft delete), clientId
 * (idempotency key for the sync queue). Generated values (bean age, flow
 * rate) are computed in packages/core at write time rather than as SQL
 * generated columns, to stay portable across the local driver and D1.
 */

const syncColumns = {
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  deletedAt: text("deleted_at"),
  clientId: text("client_id").notNull(),
};

export const product = sqliteTable("product", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["grinder", "machine", "brewer", "accessory"] }).notNull(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  imageUrl: text("image_url"),
  grindScale: text("grind_scale", { mode: "json" }).$type<{
    min: number;
    max: number;
    step: number;
    unit: string;
    label: string;
  } | null>(),
  specs: text("specs", { mode: "json" }).$type<Record<string, unknown> | null>(),
  status: text("status", { enum: ["seed", "community", "verified"] })
    .notNull()
    .default("seed"),
  ...syncColumns,
});

export const equipment = sqliteTable("equipment", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: text("product_id").references(() => product.id),
  customName: text("custom_name"),
  notes: text("notes"),
  burrKg: real("burr_kg"),
  ...syncColumns,
});

export const setup = sqliteTable("setup", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  method: text("method", {
    enum: ["espresso", "v60", "aeropress", "frenchpress", "moka", "auto"],
  }).notNull(),
  grinderEquipmentId: text("grinder_equipment_id")
    .notNull()
    .references(() => equipment.id),
  machineEquipmentId: text("machine_equipment_id").references(() => equipment.id),
  accessoryEquipmentIds: text("accessory_equipment_ids", { mode: "json" }).$type<string[]>().default([]),
  ...syncColumns,
});

export const bean = sqliteTable("bean", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  roaster: text("roaster").notNull(),
  name: text("name").notNull(),
  origin: text("origin"),
  variety: text("variety"),
  process: text("process", {
    enum: ["washed", "natural", "honey", "anaerobic", "other"],
  }),
  roastLevel: integer("roast_level"),
  roastDate: text("roast_date"),
  openedAt: text("opened_at"),
  photoUrl: text("photo_url"),
  barcode: text("barcode"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  ...syncColumns,
});

export const weatherSnapshot = sqliteTable("weather_snapshot", {
  id: text("id").primaryKey(),
  takenAt: text("taken_at").notNull(),
  tempC: real("temp_c"),
  humidityPct: real("humidity_pct"),
  pressureHpa: real("pressure_hpa"),
  source: text("source", { enum: ["open_meteo", "sensor", "manual"] }).notNull(),
  geoCell: text("geo_cell"),
  ...syncColumns,
});

export const recipe = sqliteTable("recipe", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  setupId: text("setup_id")
    .notNull()
    .references(() => setup.id),
  beanId: text("bean_id").references(() => bean.id),
  beanProfile: text("bean_profile", { mode: "json" }).$type<Record<string, unknown> | null>(),
  params: text("params", { mode: "json" }).$type<Record<string, unknown>>(),
  confidence: real("confidence"),
  brewCount: integer("brew_count").notNull().default(0),
  avgRating: real("avg_rating"),
  ...syncColumns,
});

export const brew = sqliteTable("brew", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  setupId: text("setup_id")
    .notNull()
    .references(() => setup.id),
  beanId: text("bean_id")
    .notNull()
    .references(() => bean.id),
  weatherId: text("weather_id").references(() => weatherSnapshot.id),
  brewedAt: text("brewed_at").notNull(),

  // Input
  grindSetting: real("grind_setting").notNull(),
  doseG: real("dose_g").notNull(),
  targetYieldG: real("target_yield_g").notNull(),
  waterTempC: real("water_temp_c"),
  preinfusionS: real("preinfusion_s"),
  puckPrep: text("puck_prep", { mode: "json" }).$type<Record<string, unknown> | null>(),
  beanAgeDays: integer("bean_age_days"),

  // Process
  timeTotalS: real("time_total_s").notNull(),
  timeFirstDropS: real("time_first_drop_s"),
  pressureAvgBar: real("pressure_avg_bar"),
  pressurePeakBar: real("pressure_peak_bar"),
  actualYieldG: real("actual_yield_g"),
  flowGs: real("flow_gs"),

  // Result
  ratingTotal: real("rating_total").notNull(),
  balance: integer("balance"),
  sweetness: integer("sweetness"),
  body: integer("body"),
  crema: integer("crema"),
  visualTags: text("visual_tags", { mode: "json" }).$type<string[]>().default([]),
  flavorTags: text("flavor_tags", { mode: "json" }).$type<string[]>().default([]),
  tdsPct: real("tds_pct"),
  note: text("note"),
  photoUrl: text("photo_url"),
  isDialIn: integer("is_dial_in", { mode: "boolean" }).notNull().default(false),
  recipeId: text("recipe_id").references(() => recipe.id),

  ...syncColumns,
});

export type Product = typeof product.$inferSelect;
export type NewProduct = typeof product.$inferInsert;
export type Equipment = typeof equipment.$inferSelect;
export type NewEquipment = typeof equipment.$inferInsert;
export type Setup = typeof setup.$inferSelect;
export type NewSetup = typeof setup.$inferInsert;
export type Bean = typeof bean.$inferSelect;
export type NewBean = typeof bean.$inferInsert;
export type WeatherSnapshot = typeof weatherSnapshot.$inferSelect;
export type Brew = typeof brew.$inferSelect;
export type NewBrew = typeof brew.$inferInsert;
export type Recipe = typeof recipe.$inferSelect;
export type NewRecipe = typeof recipe.$inferInsert;
