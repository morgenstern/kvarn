import { useEffect, useRef } from "react";
import { authClient } from "./client";

const { signIn, useSession } = authClient;

/**
 * Every device gets a session — anonymous by default (better-auth's anonymous
 * plugin), upgradeable to a real account later via Settings. This just means
 * "some session exists", not "the user made an account" — see
 * docs/03_TECH_KONZEPT.md §2. Best-effort: if the worker isn't running
 * locally, this silently no-ops and the app keeps working off local data.
 */
export function useEnsureSession() {
  const { data: session, isPending } = useSession();
  const attempted = useRef(false);

  useEffect(() => {
    if (isPending || session || attempted.current) return;
    attempted.current = true;
    signIn.anonymous().catch(() => {
      // No worker running locally, or offline — fine, app works on local data regardless.
    });
  }, [isPending, session]);
}
