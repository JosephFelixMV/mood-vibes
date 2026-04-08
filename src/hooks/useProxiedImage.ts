import { useState, useEffect } from "react";

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

/**
 * Hook that returns a proxied/cached image URL.
 * Shows the original URL immediately, swaps to cached URL once resolved.
 */
export function useProxiedImage(originalUrl: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!originalUrl) return null;
    return cache.get(originalUrl) || originalUrl;
  });

  useEffect(() => {
    if (!originalUrl) {
      setUrl(null);
      return;
    }

    // Already cached
    if (cache.has(originalUrl)) {
      setUrl(cache.get(originalUrl)!);
      return;
    }

    // Deduplicate in-flight requests
    let promise = pending.get(originalUrl);
    if (!promise) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      promise = fetch(
        `${supabaseUrl}/functions/v1/image-proxy?url=${encodeURIComponent(originalUrl)}`,
        {
          headers: {
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
        }
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const resolved = data?.url || originalUrl;
          cache.set(originalUrl, resolved);
          pending.delete(originalUrl);
          return resolved;
        })
        .catch(() => {
          cache.set(originalUrl, originalUrl);
          pending.delete(originalUrl);
          return originalUrl;
        });

      pending.set(originalUrl, promise);
    }

    promise.then((resolved) => setUrl(resolved));
  }, [originalUrl]);

  return url;
}
