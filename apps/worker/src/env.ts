export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PHOTOS: R2Bucket;
  WEATHER_CACHE: KVNamespace;
  /** Set via `.dev.vars` locally, `wrangler secret put BETTER_AUTH_SECRET` in production. */
  BETTER_AUTH_SECRET: string;
  /**
   * AI illustration pipeline (docs/07_ILLUSTRATION_STYLE.md §3, apps/worker/src/illustrations).
   * Optional — the /api/illustrations routes return a clear 501 until these are set via
   * `wrangler secret put` in production (or `.dev.vars` locally):
   * - GOOGLE_CSE_API_KEY / GOOGLE_CSE_CX: Google Programmable Search (Custom Search JSON API),
   *   used to find candidate reference photos for a product.
   * - GEMINI_API_KEY: Google AI Studio key for Gemini vision (rating candidates, extracting
   *   key features) and Gemini 2.5 Flash Image ("nano banana") for generation.
   */
  GOOGLE_CSE_API_KEY?: string;
  GOOGLE_CSE_CX?: string;
  GEMINI_API_KEY?: string;
}
