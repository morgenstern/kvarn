export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PHOTOS: R2Bucket;
  WEATHER_CACHE: KVNamespace;
  /** Set via `.dev.vars` locally, `wrangler secret put BETTER_AUTH_SECRET` in production. */
  BETTER_AUTH_SECRET: string;
}
