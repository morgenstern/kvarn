import type { Env } from "../env";

const GEMINI_TEXT_MODEL = "gemini-2.5-flash";
/** "nano banana" — Gemini's image-generation model, per the pipeline brief. */
const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

function geminiUrl(model: string, env: Env): string {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
}

// btoa/atob operate on JS strings, not raw bytes, and choke on large binary
// buffers passed via String.fromCharCode(...bytes) (call-stack argument
// limits). Chunking avoids both problems.
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`could not fetch reference image: ${res.status}`);
  const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { base64: bytesToBase64(bytes), mimeType };
}

/** Strips a ```json fenced block or stray prose around a JSON object, if present. */
function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const brace = text.match(/\{[\s\S]*\}/);
  return brace ? brace[0] : text.trim();
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> };
  }>;
}

export interface SuitabilityRating {
  score: number;
  reason: string;
}

/**
 * Rates a candidate reference photo for how usable it is as a shape reference
 * for the "Kvarn Sketch" illustration pipeline (clean, unobstructed, whole
 * product visible) — not for aesthetic quality of the photo itself.
 */
export async function rateImageSuitability(env: Env, imageUrl: string, productLabel: string): Promise<SuitabilityRating> {
  const { base64, mimeType } = await fetchImageAsBase64(imageUrl);
  const prompt = `You are screening a candidate photo of "${productLabel}" to use as a shape reference for a hand-drawn product illustration.
Rate 0-100 how suitable this image is as a reference: prefer a clean three-quarter or front view of the WHOLE product, uncluttered/plain background, good lighting, sharp focus, no other objects, hands, or people in frame, no heavy text overlays or watermarks obscuring the product.
Respond with ONLY compact JSON, no markdown fence: {"score": <integer 0-100>, "reason": "<one short sentence>"}`;

  const res = await fetch(geminiUrl(GEMINI_TEXT_MODEL, env), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }],
    }),
  });
  if (!res.ok) throw new Error(`Gemini rating call failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as GeminiGenerateContentResponse;
  const text = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text ?? "{}";
  const parsed = JSON.parse(extractJsonObject(text)) as { score?: unknown; reason?: unknown };
  const score = Number(parsed.score);
  return {
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
  };
}

/**
 * LLM fallback for products not in knownFeatures.ts (community submissions,
 * new catalog additions) — generates the {key_features} phrase the same way
 * an editor would per docs/08_ILLUSTRATION_REFS.md.
 */
export async function generateKeyFeatures(env: Env, kind: string, brand: string, model: string): Promise<string> {
  const prompt = `List the visually distinguishing physical features of the "${brand} ${model}" (a coffee ${kind}) as ONE comma-separated phrase, 15-30 words, in the terse visual-facts style of a product-illustration brief (shape, materials, distinctive parts, finish, proportions). No marketing language, no brand claims, no quotes, no preamble — respond with ONLY the phrase.`;

  const res = await fetch(geminiUrl(GEMINI_TEXT_MODEL, env), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini key-feature call failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as GeminiGenerateContentResponse;
  const text = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text ?? "";
  return text.trim().replace(/^"|"$/g, "");
}

/**
 * Runs the reference image + master prompt through Gemini 2.5 Flash Image
 * ("nano banana") and returns the generated PNG bytes.
 */
export async function generateIllustration(
  env: Env,
  prompt: string,
  referenceImageUrl: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const { base64, mimeType: refMimeType } = await fetchImageAsBase64(referenceImageUrl);

  const res = await fetch(geminiUrl(GEMINI_IMAGE_MODEL, env), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: refMimeType, data: base64 } }] }],
    }),
  });
  if (!res.ok) throw new Error(`Gemini image generation failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as GeminiGenerateContentResponse;
  const imagePart = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!imagePart?.inlineData) throw new Error("Gemini response did not include an image");

  return { bytes: base64ToBytes(imagePart.inlineData.data), mimeType: imagePart.inlineData.mimeType };
}
