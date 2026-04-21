import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let AUTO_DEACTIVATE_THRESHOLD = 3;
let BATCH_SIZE = 25;
let PER_VENDOR_CAP = 5;
let MIN_DELAY_MS = 2000;
let MAX_DELAY_MS = 5000;

const SOFT_BLOCK_PATTERNS = [
  /captcha/i, /cf-challenge/i, /access\s*denied/i, /blocked/i,
  /verify\s+you\s+are\s+(a\s+)?human/i, /please\s+enable\s+(javascript|cookies)/i,
  /unusual\s+traffic/i, /rate\s+limit/i,
];
const MIN_PAGE_SIZE = 1500;

function jitterDelay(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return "unknown"; }
}

function detectSoftBlock(body: string): string | null {
  if (body.length < MIN_PAGE_SIZE) return "suspicious_small_page";
  for (const pattern of SOFT_BLOCK_PATTERNS) {
    if (pattern.test(body.slice(0, 10000))) return `soft_block_detected: ${pattern.source}`;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Load config
  const { data: configRows } = await supabase
    .from("site_config").select("key, value")
    .in("key", [
      "link_check_batch_size", "link_check_deactivation_threshold",
      "link_check_vendor_cap", "link_check_min_delay_ms", "link_check_max_delay_ms",
    ]);
  const cfgMap: Record<string, string> = {};
  (configRows || []).forEach((r: any) => { cfgMap[r.key] = r.value; });

  BATCH_SIZE = parseInt(cfgMap["link_check_batch_size"] || "25", 10);
  AUTO_DEACTIVATE_THRESHOLD = parseInt(cfgMap["link_check_deactivation_threshold"] || "3", 10);
  PER_VENDOR_CAP = parseInt(cfgMap["link_check_vendor_cap"] || "5", 10);
  MIN_DELAY_MS = parseInt(cfgMap["link_check_min_delay_ms"] || "2000", 10);
  MAX_DELAY_MS = parseInt(cfgMap["link_check_max_delay_ms"] || "5000", 10);

  // Parse options
  let batchMode = false;
  let productIds: string[] | null = null;
  try {
    const body = await req.json();
    batchMode = body?.batch === true;
    if (Array.isArray(body?.product_ids) && body.product_ids.length > 0) {
      productIds = body.product_ids;
    }
  } catch { /* no body */ }

  // Build query — prioritize by last_verified_at ascending (oldest first)
  let query = supabase
    .from("products")
    .select("id, name, source_url, affiliate_url, check_failure_count, status")
    .eq("is_active", true);

  if (productIds) {
    query = query.in("id", productIds);
  } else if (batchMode) {
    query = query
      .order("last_verified_at", { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE);
  }

  const { data: products, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: { id: string; name: string; status: string; error: boolean; deactivated?: boolean; skipped?: boolean }[] = [];
  const vendorLastRequest: Record<string, number> = {};
  const vendorHitCount: Record<string, number> = {};
  const blockedVendors: Set<string> = new Set(); // vendors that returned 429

  for (const product of products || []) {
    // Missing URL checks
    const missingSource = !product.source_url || product.source_url.trim() === "";
    const missingAffiliate = !product.affiliate_url || product.affiliate_url.trim() === "";

    if (missingSource || missingAffiliate) {
      const reasons = [
        ...(missingSource ? ["missing_source_url"] : []),
        ...(missingAffiliate ? ["missing_affiliate_url"] : []),
      ];
      const detail = reasons.join(", ");
      const newCount = (product.check_failure_count || 0) + 1;
      const shouldFlag = newCount >= AUTO_DEACTIVATE_THRESHOLD;

      results.push({ id: product.id, name: product.name, status: detail, error: true, deactivated: shouldFlag });
      await supabase.from("products").update({
        page_error: true,
        page_error_detail: detail,
        check_failure_count: newCount,
        last_verified_at: new Date().toISOString(),
        ...(shouldFlag ? { status: "flagged" } : {}),
      }).eq("id", product.id);
      continue;
    }

    const vendor = getHostname(product.source_url);

    // Skip vendors that returned 429
    if (blockedVendors.has(vendor)) {
      results.push({ id: product.id, name: product.name, status: "skipped_vendor_429", error: false, skipped: true });
      await supabase.from("products").update({ last_verified_at: new Date().toISOString() }).eq("id", product.id);
      continue;
    }

    // Per-vendor cap
    vendorHitCount[vendor] = (vendorHitCount[vendor] || 0) + 1;
    if (batchMode && vendorHitCount[vendor] > PER_VENDOR_CAP) {
      results.push({ id: product.id, name: product.name, status: "skipped_vendor_cap", error: false, skipped: true });
      await supabase.from("products").update({ last_verified_at: new Date().toISOString() }).eq("id", product.id);
      continue;
    }

    // Jitter delay
    const now = Date.now();
    const lastHit = vendorLastRequest[vendor] || 0;
    const timeSinceLast = now - lastHit;
    if (timeSinceLast < MIN_DELAY_MS) {
      await jitterDelay(MIN_DELAY_MS - timeSinceLast, MAX_DELAY_MS - timeSinceLast);
    } else {
      await jitterDelay(500, 1500);
    }

    try {
      const response = await fetch(product.source_url, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": `https://www.google.com/search?q=${encodeURIComponent(product.name)}`,
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
        },
      });

      vendorLastRequest[vendor] = Date.now();
      const statusCode = response.status;

      // 429 → block vendor for rest of batch
      if (statusCode === 429) {
        blockedVendors.add(vendor);
        results.push({ id: product.id, name: product.name, status: "vendor_rate_limited_429", error: false, skipped: true });
        await supabase.from("products").update({
          last_verified_at: new Date().toISOString(),
          last_status_code: 429,
        }).eq("id", product.id);
        continue;
      }

      // Soft-block detection
      let softBlockStatus: string | null = null;
      try {
        const bodyText = await response.text();
        softBlockStatus = detectSoftBlock(bodyText);
      } catch { /* non-fatal */ }

      const finalUrl = response.url;
      const sourceUrlObj = new URL(product.source_url);
      const finalUrlObj = new URL(finalUrl);
      const sourcePath = sourceUrlObj.pathname.replace(/\/$/, "");
      const finalPath = finalUrlObj.pathname.replace(/\/$/, "");
      const sourceHost = sourceUrlObj.hostname.replace(/^www\./, "");
      const finalHost = finalUrlObj.hostname.replace(/^www\./, "");

      const redirectedToHome = finalPath === "" || finalPath === "/";
      const domainMismatch = sourceHost !== finalHost;
      const sourceHadPath = sourcePath.length > 1;
      const pathChanged = sourceHadPath && sourcePath !== finalPath;
      const redirectedAway = pathChanged && redirectedToHome;

      const hasHttpError = statusCode >= 400 && statusCode !== 403;
      let isError = false;
      let status = "ok";

      if (hasHttpError) {
        isError = true;
        status = `source_${statusCode}`;
      } else if (domainMismatch) {
        isError = true;
        status = `domain_mismatch: expected ${sourceHost}, got ${finalHost}`;
      } else if (redirectedAway) {
        isError = true;
        status = `redirected_to_home: ${finalUrl}`;
      } else if (softBlockStatus) {
        status = softBlockStatus;
      }

      const newCount = isError ? (product.check_failure_count || 0) + 1 : 0;
      const shouldFlag = isError && newCount >= AUTO_DEACTIVATE_THRESHOLD;

      // Determine new product status
      let newStatus: string | undefined;
      if (shouldFlag && product.status === "active") {
        newStatus = "flagged";
      } else if (shouldFlag && product.status === "flagged") {
        newStatus = "unpublished";
      }

      results.push({ id: product.id, name: product.name, status, error: isError, deactivated: shouldFlag });
      await supabase.from("products").update({
        page_error: isError,
        page_error_detail: isError || softBlockStatus ? status : null,
        check_failure_count: newCount,
        last_verified_at: new Date().toISOString(),
        last_status_code: statusCode,
        ...(newStatus ? { status: newStatus } : {}),
      }).eq("id", product.id);
    } catch (e) {
      vendorLastRequest[vendor] = Date.now();
      const detail = `fetch_error: ${e.message}`;
      const newCount = (product.check_failure_count || 0) + 1;
      const shouldFlag = newCount >= AUTO_DEACTIVATE_THRESHOLD;

      results.push({ id: product.id, name: product.name, status: detail, error: true, deactivated: shouldFlag });
      await supabase.from("products").update({
        page_error: true,
        page_error_detail: detail,
        check_failure_count: newCount,
        last_verified_at: new Date().toISOString(),
        last_status_code: 0,
        ...(shouldFlag ? { status: "flagged" } : {}),
      }).eq("id", product.id);
    }
  }

  const deactivated = results.filter((r) => r.deactivated).length;
  const errors = results.filter((r) => r.error).length;
  const skipped = results.filter((r) => (r as any).skipped).length;

  return new Response(JSON.stringify({
    results, checked: results.length, errors, deactivated, skipped,
    mode: batchMode ? "batch" : "full",
    blocked_vendors: Array.from(blockedVendors),
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
