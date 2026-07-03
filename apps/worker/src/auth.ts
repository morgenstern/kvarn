import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import { account, session, user, verification } from "@kvarn/db";
import type { Env } from "./env";

/**
 * better-auth per docs/03_TECH_KONZEPT.md §2: email/password + anonymous
 * (device-local, upgradeable) sessions. Apple/Google sign-in is deferred —
 * it needs OAuth client credentials from Apple/Google developer accounts
 * that this project doesn't have; wiring the config is trivial once someone
 * has them (see README).
 *
 * Constructed per-request (env/bindings only exist at request time in
 * Workers) rather than once at module scope.
 */
export function createAuth(env: Env) {
  const db = drizzle(env.DB);

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: { user, session, account, verification },
      // D1 doesn't support interactive multi-statement transactions over the binding.
      transaction: false,
    }),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [anonymous()],
    // The vite dev server (5173) proxies /api/* to this worker (8787) same-origin
    // from the browser's perspective for fetches, but the browser's Origin header
    // on those requests is still localhost:5173 — better-auth's CSRF check needs
    // that listed explicitly. In production the Worker serves the SPA itself, so
    // there's no cross-port origin to trust.
    trustedOrigins: ["http://localhost:5173", "http://127.0.0.1:5173"],
  });
}
