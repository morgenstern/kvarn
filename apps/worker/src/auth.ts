import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { account, session, user, verification, equipment, bean, brew, recipe } from "@kvarn/db";
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
    plugins: [
      anonymous({
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          // Anonymous sessions now sync by default (see
          // docs/superpowers/specs/2026-07-15-anonymous-data-sync-design.md),
          // so an anonymous user's D1 rows are real data, not scratch state.
          // better-auth's default onLinkAccount behavior deletes the
          // anonymous user row without moving anything — without this hook,
          // that data would be orphaned under a deleted user id the moment
          // someone signs up. weatherSnapshot has no userId column, so
          // there's nothing to reassign there.
          //
          // D1 doesn't support interactive transactions over the binding (see
          // `transaction: false` above), so these four updates aren't atomic —
          // and better-auth calls this hook with no try/catch of its own. If one
          // throws partway through, we log and move on rather than letting the
          // exception fail the entire sign-up/sign-in request: a rare, self-
          // healing risk (re-running this reassignment is idempotent) beats
          // blocking a real account upgrade over a transient D1 error.
          const fromId = anonymousUser.user.id;
          const toId = newUser.user.id;
          try {
            await db.update(equipment).set({ userId: toId }).where(eq(equipment.userId, fromId));
            await db.update(bean).set({ userId: toId }).where(eq(bean.userId, fromId));
            await db.update(brew).set({ userId: toId }).where(eq(brew.userId, fromId));
            await db.update(recipe).set({ userId: toId }).where(eq(recipe.userId, fromId));
          } catch (err) {
            console.error("Failed to reassign anonymous user's data on account link", err);
          }
        },
      }),
    ],
    // The vite dev server (5173) proxies /api/* to this worker (8787) same-origin
    // from the browser's perspective for fetches, but the browser's Origin header
    // on those requests is still localhost:5173 — better-auth's CSRF check needs
    // that listed explicitly. In production the Worker serves the SPA itself, so
    // there's no cross-port origin to trust.
    trustedOrigins: ["http://localhost:5173", "http://127.0.0.1:5173"],
  });
}
