import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { product_id, turnstile_token, honeypot } = body;

    if (!product_id || typeof product_id !== "string") {
      return new Response(JSON.stringify({ error: "product_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reject immediately if the Turnstile token is missing or empty.
    const tsToken = (body["cf-turnstile-response"] ?? turnstile_token ?? "").toString().trim();
    if (!tsToken) {
      return new Response(JSON.stringify({ error: "Verification required." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Honeypot check — if filled, silently accept but flag
    const honeypotTriggered = !!honeypot;

    // Turnstile verification
    let turnstilePassed = false;
    if (turnstileSecret && turnstile_token) {
      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: turnstile_token,
        }),
      });
      const verifyData = await verifyRes.json();
      turnstilePassed = verifyData.success === true;
    }

    // If Turnstile is configured AND a token was provided but failed, reject
    if (turnstileSecret && turnstile_token && !turnstilePassed && !honeypotTriggered) {
      return new Response(JSON.stringify({ error: "Verification failed. Please try again." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate fingerprint from IP + User-Agent
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const fingerprint = hashString(`${clientIp}:${userAgent}`);

    // Rate limit: 1 report per product per fingerprint per 24 hours
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("product_reports")
      .select("id")
      .eq("product_id", product_id)
      .eq("reporter_fingerprint", fingerprint)
      .gte("reported_at", dayAgo)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ message: "You've already reported this product recently. Thank you!" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert report (unique constraint on product_id + fingerprint)
    const { error: insertErr } = await supabase
      .from("product_reports")
      .upsert({
        product_id,
        reporter_fingerprint: fingerprint,
        honeypot_triggered: honeypotTriggered,
        turnstile_passed: turnstilePassed,
        reported_at: new Date().toISOString(),
      }, { onConflict: "product_id,reporter_fingerprint" });

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to submit report" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: "Thank you for your report! We'll review this product." }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("report-product error:", e);
    return new Response(JSON.stringify({ error: "Something went wrong" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
