// Dynamic sitemap.xml generator
// Public, no JWT required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc: string, lastmod?: string, changefreq?: string, priority?: string) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}${changefreq ? `\n    <changefreq>${changefreq}</changefreq>` : ""}${priority ? `\n    <priority>${priority}</priority>` : ""}
  </url>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Resolve canonical base URL from site_config, else fall back to request origin.
    const { data: cfg } = await supabase
      .from("site_config")
      .select("key,value")
      .eq("key", "canonical_base_url")
      .maybeSingle();

    let base = (cfg?.value || "").trim().replace(/\/+$/, "");
    if (!base) {
      const u = new URL(req.url);
      base = `${u.protocol}//${u.host}`;
    }

    const today = new Date().toISOString().slice(0, 10);

    // Static routes
    const staticUrls = [
      urlEntry(`${base}/`, today, "daily", "1.0"),
      urlEntry(`${base}/products`, today, "daily", "0.9"),
      urlEntry(`${base}/categories`, today, "weekly", "0.8"),
      urlEntry(`${base}/vibes`, today, "weekly", "0.8"),
      urlEntry(`${base}/moods`, today, "weekly", "0.8"),
      urlEntry(`${base}/brands`, today, "weekly", "0.7"),
      urlEntry(`${base}/discover`, today, "weekly", "0.7"),
      urlEntry(`${base}/disclosure`, today, "yearly", "0.3"),
      urlEntry(`${base}/privacy`, today, "yearly", "0.3"),
      urlEntry(`${base}/terms`, today, "yearly", "0.3"),
    ];

    // Categories (split by type for proper URL prefixes)
    const { data: categories } = await supabase
      .from("categories")
      .select("slug,type,created_at");

    const categoryUrls: string[] = [];
    for (const c of categories || []) {
      const lastmod = (c.created_at || "").slice(0, 10) || today;
      let path = "";
      if (c.type === "vibe") path = `/vibes/${c.slug}`;
      else if (c.type === "mood") path = `/moods/${c.slug}`;
      else path = `/category/${c.slug}`;
      categoryUrls.push(urlEntry(`${base}${path}`, lastmod, "weekly", "0.7"));
    }

    // Products — paginate past 1000 row cap, active only
    const productUrls: string[] = [];
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data: products, error } = await supabase
        .from("products")
        .select("slug,updated_at")
        .eq("is_active", true)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!products || products.length === 0) break;
      for (const p of products) {
        if (!p.slug) continue;
        const lastmod = (p.updated_at || "").slice(0, 10) || today;
        productUrls.push(urlEntry(`${base}/product/${p.slug}`, lastmod, "weekly", "0.6"));
      }
      if (products.length < PAGE) break;
      from += PAGE;
    }

    const brandUrls: string[] = [];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...categoryUrls, ...brandUrls, ...productUrls].join("\n")}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err: any) {
    return new Response(`Error generating sitemap: ${err?.message || String(err)}`, {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
