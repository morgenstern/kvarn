import { drizzle } from "drizzle-orm/d1";
import * as schema from "@kvarn/db";
import type { Env } from "./env";

export function getDb(env: Env) {
  return drizzle(env.DB, { schema });
}
