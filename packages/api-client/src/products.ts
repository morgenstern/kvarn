export interface ProductSubmissionInput {
  kind: "grinder" | "machine" | "brewer" | "accessory";
  brand: string;
  model: string;
  notes?: string;
}

export interface SubmittedProduct {
  id: string;
  kind: string;
  brand: string;
  model: string;
  status: "community" | "verified" | "seed";
}

/** Submit a missing device to the community moderation queue (apps/worker's /api/products/submissions). */
export async function submitProduct(input: ProductSubmissionInput): Promise<SubmittedProduct> {
  const res = await fetch("/api/products/submissions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`submission failed: ${res.status}`);
  return (await res.json()) as SubmittedProduct;
}

export async function fetchPendingSubmissions(): Promise<SubmittedProduct[]> {
  const res = await fetch("/api/products/submissions");
  if (!res.ok) throw new Error(`fetching submissions failed: ${res.status}`);
  return (await res.json()) as SubmittedProduct[];
}

export async function approveSubmission(id: string): Promise<void> {
  const res = await fetch(`/api/products/submissions/${id}/approve`, { method: "POST" });
  if (!res.ok) throw new Error(`approve failed: ${res.status}`);
}

export async function rejectSubmission(id: string): Promise<void> {
  const res = await fetch(`/api/products/submissions/${id}/reject`, { method: "POST" });
  if (!res.ok) throw new Error(`reject failed: ${res.status}`);
}
