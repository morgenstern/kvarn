export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PHOTOS: R2Bucket;
  WEATHER_CACHE: KVNamespace;
}
