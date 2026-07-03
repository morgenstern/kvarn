import { createAuthClient } from "better-auth/react";
import { anonymousClient } from "better-auth/client/plugins";

/**
 * better-auth's client requires an absolute base URL (it throws synchronously
 * at construction time otherwise, crashing the whole app before React can
 * even render). Built from window.location.origin rather than hardcoded so
 * it's still same-origin via the vite dev proxy (apps/web/vite.config.ts) in
 * dev and via the Worker serving both API and SPA in production.
 */
export const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
  plugins: [anonymousClient()],
});

// Not re-exported as individual named consts — better-auth's inferred client
// type references an internal, unexported type that TS can't portably name
// across module boundaries for a re-exported const. Destructure from
// `authClient` locally in each consuming file instead.
