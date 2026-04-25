import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function requireAdmin(req: Request, supabaseUrl: string, serviceRoleKey: string) {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return { ok: false as const, status: 401, error: "Missing bearer token" };
  const token = authHeader.slice("Bearer ".length);
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return { ok: false as const, status: 401, error: "Invalid session" };
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return { ok: false as const, status: 401, error: "Admin role required" };
  return { ok: true as const, userId: userData.user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = await requireAdmin(req, supabaseUrl, serviceRoleKey);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { brands } = await req.json();

    if (!Array.isArray(brands) || brands.length === 0) {
      return new Response(JSON.stringify({ error: "brands array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    let inserted = 0;
    let skipped = 0;

    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < brands.length; i += batchSize) {
      const batch = brands.slice(i, i + batchSize);

      const rows = batch.map((item: Record<string, unknown>) => ({
        brand: item.brand,
        match_aliases: item.match || item.match_aliases || [],
        url_match: item.url || item.url_match || "",
        group_name: item.group || item.group_name || null,
        source: item.source || null,
        core: item.core || null,
        vibes: item.vibes || null,
        moods: item.moods || null,
        hint: item.hint || null,
      }));

      const { data, error } = await supabase
        .from("brand_lookup")
        .upsert(rows, { onConflict: "brand", ignoreDuplicates: false })
        .select("id");

      if (error) {
        console.error("Upsert error:", error);
        throw error;
      }

      inserted += data?.length || 0;
    }

    return new Response(
      JSON.stringify({ inserted, total: brands.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
