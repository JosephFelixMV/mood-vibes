import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get or create today's pick
    const { data: productId, error: rpcError } = await supabase.rpc(
      "get_or_create_daily_pick",
    );

    if (rpcError || !productId) {
      return new Response(
        JSON.stringify({ error: "No daily pick available" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch the product
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select(
        "id, name, slug, description, price, image_url, video_url, affiliate_url, category, vibe_category, mood, company_name, regions",
      )
      .eq("id", productId)
      .single();

    if (pErr || !product) {
      return new Response(
        JSON.stringify({ error: "Product not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch gallery images
    const { data: images } = await supabase
      .from("product_images")
      .select("image_url, display_order")
      .eq("product_id", productId)
      .order("display_order");

    const galleryImages = (images || []).map((i) => i.image_url);

    // Get today's date in ISO format (YYYY-MM-DD)
    const today = new Date().toISOString().split("T")[0];

    // Build clean payload for social automation
    const payload = {
      pick_date: today,
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        price_formatted: `$${Number(product.price).toFixed(2)}`,
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
        affiliate_url: product.affiliate_url,
        share_facebook: buildShareUrl(product.slug, "facebook"),
        share_instagram: buildShareUrl(product.slug, "instagram"),
      },
      social_copy: {
        headline: `Today's Pick: ${product.name}`,
        caption: product.description
          ? `${product.description.substring(0, 200)}${product.description.length > 200 ? "..." : ""}`
          : `Discover ${product.name} — today's curated pick from Mood & Vibes.`,
        hashtags: [
          "#MoodAndVibes",
          "#DailyPick",
          "#ProductOfTheDay",
          ...(product.vibe_category
            ? product.vibe_category
                .split(",")
                .map((v: string) => `#${v.trim().replace(/[^a-zA-Z0-9]/g, "")}`)
                .filter((h: string) => h.length > 1)
            : []),
        ],
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
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});