import { illustrationCandidate, illustrationDraft, product, type IllustrationCandidate, type IllustrationDraft, type Product } from "@kvarn/db";
import { eq } from "drizzle-orm";
import type { Env } from "../env";
import { getDb } from "../db";
import { searchProductImages } from "./imageSearch";
import { generateIllustration, generateKeyFeatures, rateImageSuitability } from "./gemini";
import { buildIllustrationPrompt } from "./prompt";
import { genericProductType, KNOWN_KEY_FEATURES } from "./knownFeatures";

const CANDIDATES_TO_RATE = 10;
const REFERENCES_TO_GENERATE = 2;

async function resolveKeyFeatures(env: Env, p: Product): Promise<string> {
  return KNOWN_KEY_FEATURES[p.id] ?? (await generateKeyFeatures(env, p.kind, p.brand, p.model));
}

/**
 * Full pipeline for one product: search up to 10 candidate reference photos,
 * rate each for suitability, generate a "Kvarn Sketch" illustration from each
 * of the top 2, and persist everything so a moderator can pick a default.
 * Runs synchronously within a single request — every step is I/O-bound
 * (subrequests), which doesn't count against the Worker CPU-time limit.
 */
export async function runIllustrationPipeline(
  env: Env,
  productId: string,
): Promise<{ candidates: IllustrationCandidate[]; drafts: IllustrationDraft[] }> {
  const db = getDb(env);
  const [p] = await db.select().from(product).where(eq(product.id, productId)).limit(1);
  if (!p) throw new Error(`product ${productId} not found`);

  const productLabel = `${p.brand} ${p.model}`;
  const found = await searchProductImages(env, `${productLabel} product photo`);
  if (found.length === 0) throw new Error("image search returned no candidates");

  const rated = await Promise.all(
    found.slice(0, CANDIDATES_TO_RATE).map(async (candidate) => {
      try {
        const rating = await rateImageSuitability(env, candidate.imageUrl, productLabel);
        return { candidate, rating };
      } catch {
        // One bad candidate image (dead link, unfetchable format) shouldn't
        // sink the whole batch — just drop it from ranking.
        return { candidate, rating: { score: 0, reason: "could not be rated" } };
      }
    }),
  );

  const ranked = rated
    .filter((r) => r.rating.score > 0)
    .sort((a, b) => b.rating.score - a.rating.score);
  if (ranked.length === 0) throw new Error("no candidate image could be rated as usable");

  const now = new Date().toISOString();
  const candidateRows: IllustrationCandidate[] = ranked.map((r, index) => ({
    id: crypto.randomUUID(),
    productId: p.id,
    imageUrl: r.candidate.imageUrl,
    sourceUrl: r.candidate.sourceUrl ?? null,
    suitabilityScore: r.rating.score,
    suitabilityReason: r.rating.reason,
    rank: index + 1,
    createdAt: now,
  }));
  await db.insert(illustrationCandidate).values(candidateRows);

  const keyFeatures = await resolveKeyFeatures(env, p);
  const prompt = buildIllustrationPrompt({
    productName: productLabel,
    productType: genericProductType(p.kind),
    keyFeatures,
  });

  const topCandidates = candidateRows.slice(0, REFERENCES_TO_GENERATE);
  const draftRows: IllustrationDraft[] = [];
  for (const candidateRow of topCandidates) {
    const generated = await generateIllustration(env, prompt, candidateRow.imageUrl);
    const ext = generated.mimeType.includes("png") ? "png" : "jpg";
    const key = `illustrations/${p.id}/${crypto.randomUUID()}.${ext}`;
    await env.PHOTOS.put(key, generated.bytes, { httpMetadata: { contentType: generated.mimeType } });

    draftRows.push({
      id: crypto.randomUUID(),
      productId: p.id,
      candidateId: candidateRow.id,
      imageUrl: `/api/photos/${key}`,
      keyFeatures,
      isDefault: false,
      createdAt: new Date().toISOString(),
    });
  }
  await db.insert(illustrationDraft).values(draftRows);

  return { candidates: candidateRows, drafts: draftRows };
}
