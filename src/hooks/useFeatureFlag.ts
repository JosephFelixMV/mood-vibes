import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSiteConfig } from "@/hooks/useSiteConfig";

/**
 * Feature flag hook backed by `site_config` rows of the form
 *   { key: 'feature_xxx', value: 'true' | 'false' }
 *
 * Returns `true` when:
 *   - the flag value is exactly the string 'true', OR
 *   - the current Supabase Auth user has the 'admin' role in `user_roles`.
 *
 * While either query is loading we return `false` to avoid a flash of
 * gated UI for unauthenticated visitors.
 */
export function useFeatureFlag(key: string): { enabled: boolean; loading: boolean; isAdmin: boolean } {
  // Read from the shared site_config cache so we make a single request for
  // ALL feature flags + other site_config values combined.
  const flagQuery = useSiteConfig();

  const adminQuery = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return false;
      const { data, error } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const loading = flagQuery.isLoading || adminQuery.isLoading;
  const isAdmin = adminQuery.data === true;
  const flagOn = flagQuery.data?.[key] === "true";

  return {
    enabled: !loading && (flagOn || isAdmin),
    loading,
    isAdmin,
  };
}
