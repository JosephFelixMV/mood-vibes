import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Get all active products with source_url
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, affiliate_url, source_url")
    .eq("is_active", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: { id: string; name: string; status: string; error: boolean }[] = [];

  for (const product of products || []) {
    if (!product.source_url) {
      results.push({ id: product.id, name: product.name, status: "no_source_url", error: false });
      continue;
    }

    try {
      const response = await fetch(product.source_url, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SurpriseShopperBot/1.0)",
        },
      });

      const hasError = response.status >= 400;

      // Also check if affiliate link domain matches source domain
      let domainMismatch = false;
      try {
        const affiliateResponse = await fetch(product.affiliate_url, {
          method: "GET",
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; SurpriseShopperBot/1.0)",
          },
        });
        const finalUrl = affiliateResponse.url;
        const sourceHost = new URL(product.source_url).hostname.replace("www.", "");
        const finalHost = new URL(finalUrl).hostname.replace("www.", "");
        domainMismatch = sourceHost !== finalHost;
      } catch {
        domainMismatch = true;
      }

      const isError = hasError || domainMismatch;
      results.push({
        id: product.id,
        name: product.name,
        status: hasError
          ? `source_${response.status}`
          : domainMismatch
          ? "affiliate_domain_mismatch"
          : "ok",
        error: isError,
      });

      // Update page_error flag
      await supabase
        .from("products")
        .update({ page_error: isError })
        .eq("id", product.id);
    } catch (e) {
      results.push({
        id: product.id,
        name: product.name,
        status: `fetch_error: ${e.message}`,
        error: true,
      });
      await supabase
        .from("products")
        .update({ page_error: true })
        .eq("id", product.id);
    }
  }

  return new Response(JSON.stringify({ results, checked: results.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
