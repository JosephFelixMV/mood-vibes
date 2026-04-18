import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return "unknown"; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { product_id } = body;

    if (!product_id || typeof product_id !== "string") {
      return new Response(JSON.stringify({ error: "product_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read current updated_at so we can preserve it (click tracking should not
    // bump the "Last Updated" timestamp shown in the admin product list).
    const { data: currentRow } = await supabase
      .from("products")
      .select("updated_at")
      .eq("id", product_id)
      .single();
    const preservedUpdatedAt = currentRow?.updated_at;

    // Update last_click_at immediately (preserve updated_at)
    await supabase.from("products").update({
      last_click_at: new Date().toISOString(),
      ...(preservedUpdatedAt ? { updated_at: preservedUpdatedAt } : {}),
    }).eq("id", product_id);

    // Check if click validation is enabled
    const { data: cfgRow } = await supabase
      .from("site_config")
      .select("value")
      .eq("key", "click_validate_enabled")
      .single();

    if (cfgRow?.value !== "true") {
      return new Response(JSON.stringify({ validated: false, reason: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch product
    const { data: product } = await supabase
      .from("products")
      .select("id, affiliate_url, source_url, status")
      .eq("id", product_id)
      .single();

    if (!product || !product.affiliate_url) {
      return new Response(JSON.stringify({ validated: false, reason: "no_url" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Perform HEAD request to affiliate URL
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(product.affiliate_url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      clearTimeout(timeout);

      const statusCode = response.status;
      const finalUrl = response.url;

      // Check for broken link indicators
      const isBroken = statusCode === 404 || statusCode === 410;
      const sourceHost = getHostname(product.affiliate_url);
      const finalHost = getHostname(finalUrl);
      const finalPath = new URL(finalUrl).pathname.replace(/\/$/, "");
      const redirectedToHome = finalPath === "" || finalPath === "/";
      const domainMatch = sourceHost === finalHost;
      const redirectedAway = domainMatch && redirectedToHome && new URL(product.affiliate_url).pathname.length > 1;

      const shouldFlag = isBroken || redirectedAway;

      // Update product
      const updateData: Record<string, any> = {
        last_verified_at: new Date().toISOString(),
        last_status_code: statusCode,
      };

      if (shouldFlag && product.status === "active") {
        updateData.status = "flagged";
        updateData.page_error_detail = isBroken
          ? `click_check_${statusCode}`
          : `click_check_redirected_home`;
      } else if (shouldFlag && product.status === "flagged") {
        // Second failed check while flagged → unpublish
        updateData.status = "unpublished";
        updateData.page_error_detail = `click_check_confirmed_broken_${statusCode}`;
      }

      await supabase.from("products").update(updateData).eq("id", product_id);

      return new Response(JSON.stringify({
        validated: true,
        status_code: statusCode,
        flagged: shouldFlag,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      // Fetch failed (timeout, DNS, etc.) — flag but don't auto-unpublish on network errors
      await supabase.from("products").update({
        last_verified_at: new Date().toISOString(),
        last_status_code: 0,
        page_error_detail: `click_check_fetch_error`,
      }).eq("id", product_id);

      return new Response(JSON.stringify({ validated: false, reason: "fetch_error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("validate-click error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
