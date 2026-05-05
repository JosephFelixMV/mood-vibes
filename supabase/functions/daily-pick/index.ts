import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.mood-and-vibes.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-secret",
};

const SITE_URL = "https://www.mood-and-vibes.com";

function buildShareUrl(slug: string, platform: string) {
  const params = new URLSearchParams({
    utm_source: platform,
    utm_medium: "social",
    utm_campaign: "daily_pick",
  });
  return `${SITE_URL}/product/${slug}?${params.toString()}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?(p|li|ul|ol|div|h[1-6])[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "-")
    .replace(/&bull;/g, "•")
    .replace(/&hellip;/g, "...")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const providedSecret = req.headers.get("x-api-secret");
    const expectedSecret = Deno.env.get("SOCIAL_API_SECRET");
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);

    // Get or create today's pick
    const { data: productId, error: rpcError } = await supabase.rpc("get_or_create_daily_pick");

    if (rpcError || !productId) {
      return new Response(JSON.stringify({ error: "No daily pick available" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the product
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select(
        "id, name, slug, description, price, image_url, video_url, category, vibe_category, mood, company_name, regions",
      )
      .eq("id", productId)
      .single();

    if (pErr || !product) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch gallery images and vibe slugs in parallel
    const [{ data: images }, { data: vibeJunction }] = await Promise.all([
      supabase
        .from("product_images")
        .select("image_url, display_order")
        .eq("product_id", productId)
        .order("display_order"),
      supabase
        .from("product_vibes")
        .select("vibe_slug")
        .eq("product_id", productId)
        .order("display_order"),
    ]);

    const galleryImages = (images || []).map((i) => i.image_url);

    // Get today's date in ISO format (YYYY-MM-DD)
    const today = new Date().toISOString().split("T")[0];

    const description_plain = product.description ? stripHtml(product.description) : "";
    const description_truncated =
      description_plain.length > 200 ? `${description_plain.substring(0, 200)}...` : description_plain;
    const brandSuffix = product.company_name ? ` by ${product.company_name}` : "";
    const price_formatted = `$${Number(product.price).toFixed(2)}`;
    const hashtags = [
      "#MoodAndVibes",
      "#DailyPick",
      "#ProductOfTheDay",
      ...(vibeJunction || []).map((v) => {
        const tag = v.vibe_slug
          .split("-")
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join("");
        return `#${tag}`;
      }).filter((h: string) => h.length > 1),
    ];
    const hashtagsStr = hashtags.join(" ");
    const share_facebook = buildShareUrl(product.slug, "facebook");
    const caption_instagram = `✨ Today's Pick: ${product.name}${brandSuffix}\n\n${description_truncated}\n\n${price_formatted} — Link in bio to shop today's pick 👆\n\n#ad #affiliate ${hashtagsStr}`;
    const caption_facebook = `✨ Today's Pick: ${product.name}${brandSuffix}\n\n${description_truncated}\n\n${price_formatted} — Shop here: ${share_facebook}\n\n#ad #affiliate ${hashtagsStr}`;

    // Build clean payload for social automation
    const payload = {
      pick_date: today,
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        price_formatted,
        brand: product.company_name,
        category: product.category,
        vibe: product.vibe_category,
        mood: product.mood,
        regions: product.regions,
        image_url: product.image_url,
        video_url: product.video_url,
        gallery_images: galleryImages,
      },
      urls: {
        product_page: `${SITE_URL}/product/${product.slug}`,
        share_facebook,
        share_instagram: buildShareUrl(product.slug, "instagram"),
      },
      social_copy: {
        headline: `Today's Pick: ${product.name}`,
        description_plain,
        caption_instagram,
        caption_facebook,
        disclosure: "#ad #affiliate",
        hashtags,
      },
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
