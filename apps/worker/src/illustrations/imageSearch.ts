import type { Env } from "../env";

export interface ImageSearchResult {
  imageUrl: string;
  sourceUrl?: string;
  title?: string;
}

interface GoogleCseItem {
  link: string;
  title?: string;
  image?: { contextLink?: string };
}

interface GoogleCseResponse {
  items?: GoogleCseItem[];
}

/**
 * Finds candidate reference photos for a product via Google Programmable
 * Search (Custom Search JSON API, image mode). The API caps a single request
 * at 10 results, which matches the "up to 10 images" pipeline requirement.
 */
export async function searchProductImages(env: Env, query: string): Promise<ImageSearchResult[]> {
  if (!env.GOOGLE_CSE_API_KEY || !env.GOOGLE_CSE_CX) {
    throw new Error("GOOGLE_CSE_API_KEY / GOOGLE_CSE_CX not configured");
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", env.GOOGLE_CSE_API_KEY);
  url.searchParams.set("cx", env.GOOGLE_CSE_CX);
  url.searchParams.set("q", query);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", "10");
  url.searchParams.set("safe", "active");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Google image search failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as GoogleCseResponse;
  return (data.items ?? []).map((item) => ({
    imageUrl: item.link,
    sourceUrl: item.image?.contextLink,
    title: item.title,
  }));
}
