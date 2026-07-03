/**
 * Uploads a photo (bean label, equipment) to apps/worker's R2-backed
 * /api/photos endpoint. Returns the relative URL to fetch it back from.
 * Client-side resizing is deferred — docs/03_TECH_KONZEPT.md §2 calls for
 * WebP + max 1600px client-side, worth adding once photo volume matters.
 */
export async function uploadPhoto(file: Blob): Promise<string> {
  const res = await fetch("/api/photos", {
    method: "POST",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!res.ok) throw new Error(`photo upload failed: ${res.status}`);
  const data = (await res.json()) as { url: string };
  return data.url;
}
