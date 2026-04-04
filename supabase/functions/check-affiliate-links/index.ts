import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, source_url, affiliate_url")
    .eq("is_active", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: { id: string; name: string; status: string; error: boolean }[] = [];

  for (const product of products || []) {
    const missingSource = !product.source_url || product.source_url.trim() === "";
    const missingAffiliate = !product.affiliate_url || product.affiliate_url.trim() === "";

    if (missingSource || missingAffiliate) {
      const reasons = [
        ...(missingSource ? ["missing_source_url"] : []),
        ...(missingAffiliate ? ["missing_affiliate_url"] : []),
      ];
      const detail = reasons.join(", ");
      results.push({ id: product.id, name: product.name, status: detail, error: true });
      await supabase.from("products").update({ page_error: true, page_error_detail: detail }).eq("id", product.id);
      continue;
    }

    try {
      // Follow redirects to the final URL
      const response = await fetch(product.source_url, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      await delay(2000);

      const finalUrl = response.url;
      // 403 is common bot-blocking — not a real product error
      const hasHttpError = response.status >= 400 && response.status !== 403;

      // Check if redirected to a home page or generic error page
      const sourceUrlObj = new URL(product.source_url);
      const finalUrlObj = new URL(finalUrl);

      const sourcePath = sourceUrlObj.pathname.replace(/\/$/, "");
      const finalPath = finalUrlObj.pathname.replace(/\/$/, "");

      // Detect redirect to home page (path becomes "/" or empty)
      const redirectedToHome = finalPath === "" || finalPath === "/";

      // Detect domain mismatch (redirected to a completely different site)
      const sourceHost = sourceUrlObj.hostname.replace(/^www\./, "");
      const finalHost = finalUrlObj.hostname.replace(/^www\./, "");
      const domainMismatch = sourceHost !== finalHost;

      // Detect if the source had a product-like path but final URL lost it
      const sourceHadPath = sourcePath.length > 1;
      const pathChanged = sourceHadPath && sourcePath !== finalPath;
      const redirectedAway = pathChanged && redirectedToHome;

      let isError = false;
      let status = "ok";

      if (hasHttpError) {
        isError = true;
        status = `source_${response.status}`;
      } else if (domainMismatch) {
        isError = true;
        status = `domain_mismatch: expected ${sourceHost}, got ${finalHost}`;
      } else if (redirectedAway) {
        isError = true;
        status = `redirected_to_home: ${finalUrl}`;
      }

      results.push({ id: product.id, name: product.name, status, error: isError });
      await supabase.from("products").update({ page_error: isError, page_error_detail: isError ? status : null }).eq("id", product.id);
    } catch (e) {
      const detail = `fetch_error: ${e.message}`;
      results.push({
        id: product.id,
        name: product.name,
        status: detail,
        error: true,
      });
      await supabase.from("products").update({ page_error: true, page_error_detail: detail }).eq("id", product.id);
    }
  }

  return new Response(JSON.stringify({ results, checked: results.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
