import { useEffect, useState } from "react";
import { Button, Card, EntityImage } from "@kvarn/ui";
import { approveSubmission, fetchPendingSubmissions, rejectSubmission, type SubmittedProduct } from "@kvarn/api-client";
import { Check, ShieldCheck, X } from "lucide-react";

const KNOWN_KINDS = ["grinder", "machine", "brewer", "accessory"] as const;
function submissionKind(kind: string): (typeof KNOWN_KINDS)[number] {
  return (KNOWN_KINDS as readonly string[]).includes(kind) ? (kind as (typeof KNOWN_KINDS)[number]) : "accessory";
}
import { useT } from "../i18n";
import { authClient } from "../auth/client";

const { useSession } = authClient;

/**
 * Community equipment moderation queue (docs/03_TECH_KONZEPT.md §4 step 2).
 * Gated to signed-in, non-anonymous sessions — see requireModerator() below.
 * Still not role-based (any signed-in account can moderate); a real "admin"
 * role is future work once there's more than one trusted user.
 */
export function Moderation() {
  const { data: session, isPending } = useSession();
  const [pending, setPending] = useState<SubmittedProduct[] | null>(null);
  const [error, setError] = useState(false);
  const t = useT("moderation");

  const canModerate = !!session?.user && !session.user.isAnonymous;

  async function reload() {
    try {
      setPending(await fetchPendingSubmissions());
      setError(false);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    if (canModerate) reload();
  }, [canModerate]);

  return (
    <div>
      <h1 className="flex items-center gap-2 font-display text-[32px] mt-3.5 mb-0.5">
        <ShieldCheck size={28} strokeWidth={1.5} />
        {t("title")}
      </h1>
      <p className="text-base text-muted">{t("subtitle")}</p>

      {isPending ? null : !canModerate ? (
        <Card>
          <p className="text-base">{t("signInRequired")}</p>
        </Card>
      ) : (
        <>
          {error ? (
            <Card>
              <p className="text-base">{t("workerUnreachable", { code: "pnpm dev:worker" })}</p>
            </Card>
          ) : null}

          {pending && pending.length === 0 ? (
            <Card>
              <p className="text-base">{t("noPending")}</p>
            </Card>
          ) : null}

          {pending?.map((p) => (
            <Card key={p.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <EntityImage kind={submissionKind(p.kind)} className="w-10 h-10 flex-none" />
                  <div>
                    <div className="text-base font-medium">
                      {p.brand} {p.model}
                    </div>
                    <div className="text-sm text-muted">{p.kind}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="!w-auto !mt-0 !py-2 !px-4"
                    onClick={async () => {
                      await approveSubmission(p.id);
                      reload();
                    }}
                  >
                    <Check size={16} strokeWidth={1.5} />
                    {t("approve")}
                  </Button>
                  <Button
                    variant="ghost"
                    className="!w-auto !mt-0 !py-2 !px-4"
                    onClick={async () => {
                      await rejectSubmission(p.id);
                      reload();
                    }}
                  >
                    <X size={16} strokeWidth={1.5} />
                    {t("reject")}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
