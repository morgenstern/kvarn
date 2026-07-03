export interface IllustrationCandidate {
  id: string;
  productId: string;
  imageUrl: string;
  sourceUrl: string | null;
  suitabilityScore: number | null;
  suitabilityReason: string | null;
  rank: number | null;
}

export interface IllustrationDraft {
  id: string;
  productId: string;
  candidateId: string | null;
  imageUrl: string;
  keyFeatures: string | null;
  isDefault: boolean;
}

/** Runs the full search → rate → generate pipeline for a product (apps/worker's /api/illustrations). */
export async function generateIllustrations(
  productId: string,
): Promise<{ candidates: IllustrationCandidate[]; drafts: IllustrationDraft[] }> {
  const res = await fetch(`/api/illustrations/${productId}/generate`, { method: "POST" });
  if (!res.ok) throw new Error(`illustration generation failed: ${res.status}`);
  return (await res.json()) as { candidates: IllustrationCandidate[]; drafts: IllustrationDraft[] };
}

export async function fetchIllustrations(
  productId: string,
): Promise<{ candidates: IllustrationCandidate[]; drafts: IllustrationDraft[] }> {
  const res = await fetch(`/api/illustrations/${productId}`);
  if (!res.ok) throw new Error(`fetching illustrations failed: ${res.status}`);
  return (await res.json()) as { candidates: IllustrationCandidate[]; drafts: IllustrationDraft[] };
}

export async function setDefaultIllustration(draftId: string): Promise<void> {
  const res = await fetch(`/api/illustrations/drafts/${draftId}/set-default`, { method: "POST" });
  if (!res.ok) throw new Error(`setting default illustration failed: ${res.status}`);
}
