import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brands } = await req.json();

    if (!Array.isArray(brands) || brands.length === 0) {
      return new Response(JSON.stringify({ error: "brands array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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
