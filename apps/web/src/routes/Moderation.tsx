import { useEffect, useState } from "react";
import { Button, Card, EntityImage, SectionLabel } from "@kvarn/ui";
import {
  approveSubmission,
  fetchPendingSubmissions,
  fetchVerifiedProducts,
  generateIllustrations,
  rejectSubmission,
  setDefaultIllustration,
  type IllustrationDraft,
  type SubmittedProduct,
  type VerifiedProduct,
} from "@kvarn/api-client";
import { Check, ShieldCheck, Sparkles, X } from "lucide-react";
import { useT } from "../i18n";
import { authClient } from "../auth/client";

const { useSession } = authClient;

const KNOWN_KINDS = ["grinder", "machine", "brewer", "accessory"] as const;
function submissionKind(kind: string): (typeof KNOWN_KINDS)[number] {
  return (KNOWN_KINDS as readonly string[]).includes(kind) ? (kind as (typeof KNOWN_KINDS)[number]) : "accessory";
}

type IllustrationGenState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; drafts: IllustrationDraft[] }
  | { status: "error"; message: string };

/**
 * Community equipment moderation queue (docs/03_TECH_KONZEPT.md §4 step 2)
 * plus the AI illustration pipeline (docs/07_ILLUSTRATION_STYLE.md §3) for
 * products that were approved but have no "Kvarn Sketch" illustration yet.
 * Gated to signed-in, non-anonymous sessions — see canModerate below.
 * Still not role-based (any signed-in account can moderate) and the worker
 * endpoints themselves aren't auth-checked yet either; a real "admin" role
 * is future work once there's more than one trusted user.
 */
export function Moderation() {
  const { data: session, isPending } = useSession();
  const [pending, setPending] = useState<SubmittedProduct[] | null>(null);
  const [verified, setVerified] = useState<VerifiedProduct[] | null>(null);
  const [error, setError] = useState(false);
  const [illustrationState, setIllustrationState] = useState<Record<string, IllustrationGenState>>({});
  const t = useT("moderation");

  const canModerate = !!session?.user && !session.user.isAnonymous;

  async function reload() {
    try {
      const [pendingSubmissions, verifiedProducts] = await Promise.all([fetchPendingSubmissions(), fetchVerifiedProducts()]);
      setPending(pendingSubmissions);
      setVerified(verifiedProducts);
      setError(false);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    if (canModerate) reload();
  }, [canModerate]);

  async function generateFor(productId: string) {
    setIllustrationState((s) => ({ ...s, [productId]: { status: "loading" } }));
    try {
      const { drafts } = await generateIllustrations(productId);
      setIllustrationState((s) => ({ ...s, [productId]: { status: "done", drafts } }));
    } catch (err) {
      setIllustrationState((s) => ({
        ...s,
        [productId]: { status: "error", message: err instanceof Error ? err.message : "unknown error" },
      }));
    }
  }

  async function pickDefault(productId: string, draftId: string) {
    await setDefaultIllustration(draftId);
    setIllustrationState((s) => {
      const current = s[productId];
      if (current?.status !== "done") return s;
      return { ...s, [productId]: { status: "done", drafts: current.drafts.map((d) => ({ ...d, isDefault: d.id === draftId })) } };
    });
    reload();
  }

  const missingIllustrations = (verified ?? []).filter((p) => !p.imageUrl);

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
                  <EntityImage kind={submissionKind(p.kind)} className="w-14 h-14 flex-none" />
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

          {missingIllustrations.length > 0 ? (
            <>
              <SectionLabel icon={Sparkles} className="mt-6">
                {t("illustrationsTitle")}
              </SectionLabel>
              {missingIllustrations.map((p) => {
                const gen = illustrationState[p.id] ?? { status: "idle" as const };
                return (
                  <Card key={p.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <EntityImage kind={submissionKind(p.kind)} className="w-14 h-14 flex-none" />
                        <div className="text-base font-medium">
                          {p.brand} {p.model}
                        </div>
                      </div>
                      <Button
                        className="!w-auto !mt-0 !py-2 !px-4"
                        disabled={gen.status === "loading"}
                        onClick={() => generateFor(p.id)}
                      >
                        <Sparkles size={16} strokeWidth={1.5} />
                        {gen.status === "loading" ? t("illustrationsGenerating") : t("illustrationsGenerate")}
                      </Button>
                    </div>

                    {gen.status === "error" ? <p className="text-sm text-clay mt-3">{gen.message}</p> : null}

                    {gen.status === "done" ? (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {gen.drafts.map((draft) => (
                          <div key={draft.id} className="flex flex-col gap-2">
                            <img src={draft.imageUrl} alt="" className="w-full aspect-square object-cover rounded-control bg-birch" />
                            <Button
                              variant={draft.isDefault ? "solid" : "ghost"}
                              className="!w-full !mt-0 !py-2 !px-3 !text-[13px]"
                              onClick={() => pickDefault(p.id, draft.id)}
                            >
                              {draft.isDefault ? t("illustrationsIsDefault") : t("illustrationsSetDefault")}
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
