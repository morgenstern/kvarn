import { useEffect, useState } from "react";
import { Button, Card } from "@kvarn/ui";
import { approveSubmission, fetchPendingSubmissions, rejectSubmission, type SubmittedProduct } from "@kvarn/api-client";

/**
 * Unlisted moderation queue for community equipment submissions
 * (docs/03_TECH_KONZEPT.md §4 step 2). NOT actually access-controlled —
 * better-auth hasn't landed yet (see docs/04_DEV_PLAN.md M0/M4). This is a
 * functional review workflow, reachable only by URL, not a secured admin
 * surface. Wire real auth before this is load-bearing.
 */
export function Moderation() {
  const [pending, setPending] = useState<SubmittedProduct[] | null>(null);
  const [error, setError] = useState(false);

  async function reload() {
    try {
      setPending(await fetchPendingSubmissions());
      setError(false);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <div>
      <h1 className="font-display text-[28px] mt-3.5 mb-0.5">Moderation</h1>
      <p className="text-sm text-muted">
        Community-Vorschläge prüfen. Noch ohne Zugriffsschutz — nicht verlinkt, nur per URL erreichbar.
      </p>

      {error ? (
        <Card>
          <p className="text-sm">Worker nicht erreichbar. Läuft <code>pnpm dev:worker</code>?</p>
        </Card>
      ) : null}

      {pending && pending.length === 0 ? (
        <Card>
          <p className="text-sm">Keine offenen Vorschläge.</p>
        </Card>
      ) : null}

      {pending?.map((p) => (
        <Card key={p.id}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">
                {p.brand} {p.model}
              </div>
              <div className="text-xs text-muted">{p.kind}</div>
            </div>
            <div className="flex gap-2">
              <Button
                className="!w-auto !mt-0 !py-2 !px-4"
                onClick={async () => {
                  await approveSubmission(p.id);
                  reload();
                }}
              >
                Freigeben
              </Button>
              <Button
                variant="ghost"
                className="!w-auto !mt-0 !py-2 !px-4"
                onClick={async () => {
                  await rejectSubmission(p.id);
                  reload();
                }}
              >
                Ablehnen
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
