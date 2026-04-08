import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AUTO_DEACTIVATE_THRESHOLD = 3;
const PER_VENDOR_DELAY_MS = 3000; // 3s between requests to same vendor
const GLOBAL_DELAY_MS = 1000;     // 1s minimum between any requests
const BATCH_SIZE = 25;            // max products per invocation (for scheduled runs)

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Parse options: batch mode (scheduled) vs full check (manual from admin)
  let batchMode = false;
  try {
    const body = await req.json();
    batchMode = body?.batch === true;
  } catch {
    // no body = full check (manual trigger)
  }

  let query = supabase
    .from("products")
    .select("id, name, source_url, affiliate_url, check_failure_count")
    .eq("is_active", true);

  if (batchMode) {
    // In batch mode: check oldest-checked products first, limited batch
    query = query
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE);
  }

  const { data: products, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: { id: string; name: string; status: string; error: boolean; deactivated?: boolean }[] = [];
  const vendorLastRequest: Record<string, number> = {};

  for (const product of products || []) {
    const missingSource = !product.source_url || product.source_url.trim() === "";
    const missingAffiliate = !product.affiliate_url || product.affiliate_url.trim() === "";

    if (missingSource || missingAffiliate) {
      const reasons = [
        ...(missingSource ? ["missing_source_url"] : []),
        ...(missingAffiliate ? ["missing_affiliate_url"] : []),
      ];
      const detail = reasons.join(", ");
      const newCount = (product.check_failure_count || 0) + 1;
      const shouldDeactivate = newCount >= AUTO_DEACTIVATE_THRESHOLD;

      results.push({ id: product.id, name: product.name, status: detail, error: true, deactivated: shouldDeactivate });
      await supabase.from("products").update({
        page_error: true,
        page_error_detail: detail,
        check_failure_count: newCount,
        last_checked_at: new Date().toISOString(),
        ...(shouldDeactivate ? { is_active: false } : {}),
      }).eq("id", product.id);
      continue;
    }

    // Per-vendor rate limiting: wait if we recently hit this vendor
    const vendor = getHostname(product.source_url);
    const now = Date.now();
    const lastHit = vendorLastRequest[vendor] || 0;
    const vendorWait = Math.max(0, PER_VENDOR_DELAY_MS - (now - lastHit));
    const globalWait = GLOBAL_DELAY_MS;
    await delay(Math.max(vendorWait, globalWait));

    try {
      const response = await fetch(product.source_url, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      vendorLastRequest[vendor] = Date.now();

      const finalUrl = response.url;
      const hasHttpError = response.status >= 400 && response.status !== 403;

      const sourceUrlObj = new URL(product.source_url);
      const finalUrlObj = new URL(finalUrl);

      const sourcePath = sourceUrlObj.pathname.replace(/\/$/, "");
      const finalPath = finalUrlObj.pathname.replace(/\/$/, "");

      const redirectedToHome = finalPath === "" || finalPath === "/";
      const sourceHost = sourceUrlObj.hostname.replace(/^www\./, "");
      const finalHost = finalUrlObj.hostname.replace(/^www\./, "");
      const domainMismatch = sourceHost !== finalHost;

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

      // Update failure count
      const newCount = isError ? (product.check_failure_count || 0) + 1 : 0;
      const shouldDeactivate = isError && newCount >= AUTO_DEACTIVATE_THRESHOLD;

      results.push({ id: product.id, name: product.name, status, error: isError, deactivated: shouldDeactivate });
      await supabase.from("products").update({
        page_error: isError,
        page_error_detail: isError ? status : null,
        check_failure_count: newCount,
        last_checked_at: new Date().toISOString(),
        ...(shouldDeactivate ? { is_active: false } : {}),
      }).eq("id", product.id);
    } catch (e) {
      vendorLastRequest[vendor] = Date.now();
      const detail = `fetch_error: ${e.message}`;
      const newCount = (product.check_failure_count || 0) + 1;
      const shouldDeactivate = newCount >= AUTO_DEACTIVATE_THRESHOLD;

      results.push({ id: product.id, name: product.name, status: detail, error: true, deactivated: shouldDeactivate });
      await supabase.from("products").update({
        page_error: true,
        page_error_detail: detail,
        check_failure_count: newCount,
        last_checked_at: new Date().toISOString(),
        ...(shouldDeactivate ? { is_active: false } : {}),
      }).eq("id", product.id);
    }
  }

  const deactivated = results.filter((r) => r.deactivated).length;
  const errors = results.filter((r) => r.error).length;

  return new Response(JSON.stringify({
    results,
    checked: results.length,
    errors,
    deactivated,
    mode: batchMode ? "batch" : "full",
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
