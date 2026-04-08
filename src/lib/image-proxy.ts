import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string>();

/**
 * Returns a cached/proxied URL for an external product image.
 * On first call, triggers the edge function to cache the image in storage.
 * Uses an in-memory map to avoid redundant calls within the same session.
 */
export async function getProxiedImageUrl(originalUrl: string): Promise<string> {
  if (!originalUrl) return originalUrl;

  // Already resolved this session
  if (cache.has(originalUrl)) {
    return cache.get(originalUrl)!;
  }

  try {
    const { data, error } = await supabase.functions.invoke("image-proxy", {
      body: null,
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    // supabase.functions.invoke doesn't support query params well,
    // so let's call it directly
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const res = await fetch(
      `${supabaseUrl}/functions/v1/image-proxy?url=${encodeURIComponent(originalUrl)}`,
      {
        headers: {
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
      }
    );

    if (!res.ok) {
      // Fallback to original
      cache.set(originalUrl, originalUrl);
      return originalUrl;
    }

    const result = await res.json();
    const proxiedUrl = result.url || originalUrl;
    cache.set(originalUrl, proxiedUrl);
    return proxiedUrl;
  } catch {
    cache.set(originalUrl, originalUrl);
    return originalUrl;
  }
}

/**
 * Hook-friendly: returns original URL immediately, then swaps to cached URL.
 * Use this for non-blocking image display.
 */
export function getImageUrl(originalUrl: string | null): string | null {
  if (!originalUrl) return null;
  // Trigger background caching
  getProxiedImageUrl(originalUrl);
  // Return original immediately — next render will pick up cached version
  return cache.get(originalUrl) || originalUrl;
}
