import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Shared site_config fetch.
 *
 * Fetches every row from `site_config` in a single round trip and exposes the
 * result as a `key -> value` map. All page-load consumers (feature flags,
 * analytics IDs, Turnstile site key, etc.) should read from this hook instead
 * of issuing their own per-key query so the homepage only makes one request
 * to `site_config`.
 */
export type SiteConfigMap = Record<string, string>;

export const SITE_CONFIG_QUERY_KEY = ["site-config-all"] as const;

export function useSiteConfig() {
  return useQuery({
    queryKey: SITE_CONFIG_QUERY_KEY,
    queryFn: async (): Promise<SiteConfigMap> => {
      const { data, error } = await (supabase as any)
        .from("site_config")
        .select("key,value");
      if (error) throw error;
      const map: SiteConfigMap = {};
      for (const row of (data ?? []) as { key: string; value: string | null }[]) {
        map[row.key] = row.value ?? "";
      }
      return map;
    },
    // site_config rarely changes during a session; keep it cached for a while
    staleTime: 1000 * 60 * 60,
  });
}

/** Read a single config value from the shared cache (defaults to empty string). */
export function useSiteConfigValue(key: string): { value: string; loading: boolean } {
  const { data, isLoading } = useSiteConfig();
  return { value: data?.[key] ?? "", loading: isLoading };
}