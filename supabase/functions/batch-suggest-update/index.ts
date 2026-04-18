import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cap keyword tags at `max` while preserving any "gift for ..." phrase.
function capKeywordsPreservingGiftFor(values: string[], max = 6): string[] {
  const deduped = Array.from(new Set(values.map((v) => v.toLowerCase().trim()).filter(Boolean)));
  if (deduped.length <= max) return deduped;
  const giftIdx = deduped.findIndex((k) => k.includes("gift for"));
  if (giftIdx === -1 || giftIdx < max) return deduped.slice(0, max);
  const kept = deduped.slice(0, max - 1);
  kept.push(deduped[giftIdx]);
  return kept;
}

async function callAnthropic(opts: {
  apiKey: string;
  system?: string;
  user: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? "claude-haiku-4-5",
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.3,
      ...(opts.system ? { system: opts.system } : {}),
      messages: [{ role: "user", content: opts.user }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (typeof text !== "string") throw new Error("No text in Anthropic response");
  return text;
}

async function loadCategories(sb: any) {
  const { data } = await sb
    .from("categories")
    .select("name, type, description, parent_slug")
    .order("name");
  const rows = data || [];

  const core = rows
    .filter((r: any) => r.type === "core" && r.parent_slug)
    .map((r: any) => r.name);

  const vibes = rows
    .filter((r: any) => r.type === "vibe")
    .map((r: any) => r.name);

  const moods: Record<string, string> = {};
  rows
    .filter((r: any) => r.type === "mood")
    .forEach((r: any) => {
      moods[r.name] = r.description || r.name;
    });

  return { core, vibes, moods };
}

async function getBrandHint(sb: any, sourceUrl?: string): Promise<string> {
  const url = (sourceUrl || "").toLowerCase();
  if (!url) return "";

  const { data: byUrl } = await sb
    .from("brand_lookup")
    .select("core, vibes, moods, hint")
    .neq("url_match", "")
    .limit(100);

  const match = (byUrl || []).find((r: any) => r.url_match && url.includes(r.url_match));
  if (!match) return "";

  const parts = [];
  if (match.hint) parts.push(`Brand context: ${match.hint}`);
  if (match.core?.length) parts.push(`Typical core categories: ${match.core.join(", ")}`);
  if (match.vibes?.length) parts.push(`Typical vibes: ${match.vibes.join(", ")}`);
  if (match.moods?.length) parts.push(`Typical moods: ${match.moods.join(", ")}`);
  return parts.length ? `\nBRAND CONTEXT:\n${parts.join("\n")}\n` : "";
}

interface CategoryLists {
  core: string[];
  vibes: string[];
  moods: Record<string, string>;
}

async function suggestForProduct(
  name: string,
  description: string,
  price: number,
  apiKey: string,
  categories: CategoryLists,
  brandHint = "",
) {
  const { core: CORE_CATEGORIES, vibes: VIBE_CATEGORIES, moods: MOOD_CATEGORIES } = categories;

  const moodList = Object.entries(MOOD_CATEGORIES)
    .map(([mood, anchors]) => `- ${mood}: ${anchors}`)
    .join("\n");

  const prompt = `You are a product categorization assistant. Given a product, select the most fitting categories, vibes, moods, and suggest relevant keywords.

CORE CATEGORIES (pick 1-5 that best fit):
${CORE_CATEGORIES.join(", ")}

VIBE CATEGORIES (pick 0-4 that best fit the product's aesthetic/vibe):
${VIBE_CATEGORIES.join(", ")}

MOOD CATEGORIES (pick 1-3 that best describe the feeling/emotion this product evokes):
${moodList}

Product Name: ${name || "Unknown"}
${brandHint}Description: ${description || "No description"}
Price: ${price || "Unknown"}

Respond ONLY with valid JSON in this exact format, no other text:
{"core": ["Category1"], "vibes": ["Vibe1"], "moods": ["Mood1"], "keywords": ["keyword1", "keyword2"]}

Use exact category/vibe/mood names from the lists above. Pick categories that genuinely fit.
For keywords, suggest 4-6 lowercase search terms shoppers might use to find this product.`;

  const content = await callAnthropic({
    apiKey,
    user: prompt,
    maxTokens: 1024,
    temperature: 0.3,
  });

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");

  const suggestions = JSON.parse(jsonMatch[0]);
  const moodNames = Object.keys(MOOD_CATEGORIES);

  let core = (suggestions.core || []).filter((c: string) => CORE_CATEGORIES.includes(c)).slice(0, 5);
  let vibes = (suggestions.vibes || []).filter((v: string) => VIBE_CATEGORIES.includes(v)).slice(0, 4);
  let moods = (suggestions.moods || []).filter((m: string) => moodNames.includes(m)).slice(0, 3);
  const keywords = (suggestions.keywords || []).map((k: string) => k.toLowerCase().trim()).filter(Boolean).slice(0, 6);

  // Auto-assign "The Atelier" vibe and "Luxe" mood for fashion items over $1000
  const FASHION_CATEGORIES = ["Women's Fashion", "Men's Fashion", "Women's Shoes", "Men's Shoes", "Activewear", "Accessories", "Bags & Totes", "Jewelry", "Watches"];
  const parsedPrice = typeof price === "number" ? price : parseFloat(String(price));
  const isFashion = core.some((c: string) => FASHION_CATEGORIES.includes(c));
  if (isFashion && parsedPrice >= 1000) {
    if (!vibes.includes("The Atelier")) vibes = ["The Atelier", ...vibes].slice(0, 4);
    if (!moods.includes("Luxe")) moods = ["Luxe", ...moods].slice(0, 3);
  }

  // Auto-assign "Pure Routine" vibe for skincare/wellness/beauty routine products
  const PURE_ROUTINE_CATEGORIES = ["Skin Care", "Hair Care", "Body Care", "Beauty Tools & Devices", "Health & Wellness"];
  const isPureRoutine = core.some((c: string) => PURE_ROUTINE_CATEGORIES.includes(c));
  if (isPureRoutine && !vibes.includes("Pure Routine")) {
    vibes = [...vibes, "Pure Routine"].slice(0, 4);
  }

  // Auto-assign "Calm" and "Summer Glow" moods for skincare/wellness/beauty products
  if (isPureRoutine) {
    if (!moods.includes("Calm")) moods = [...moods, "Calm"].slice(0, 3);
    if (!moods.includes("Summer Glow")) moods = [...moods, "Summer Glow"].slice(0, 3);
  }

  return { core, vibes, moods, keywords };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load categories from the database
    const categories = await loadCategories(supabase);

    const body = await req.json().catch(() => ({}));
    const offset = body.offset || 0;
    const limit = body.limit || 10;

    // Fetch active products with pagination
    const { data: products, error: fetchError } = await supabase
      .from("products")
      .select("id, name, description, price, category, vibe_category, mood, source_url, vendor_id")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (fetchError) throw fetchError;
    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ message: "No products found", updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${products.length} products...`);

    const results: Array<{ id: string; name: string; status: string; suggestions?: any }> = [];

    // Process sequentially to avoid rate limits
    for (const product of products) {
      try {
        console.log(`Processing: ${product.name}`);
        const brandHint = await getBrandHint(supabase, product.source_url);
        const suggestions = await suggestForProduct(
          product.name,
          product.description || "",
          product.price,
          ANTHROPIC_API_KEY!,
          categories,
          brandHint,
        );

        // Build update object - merge AI suggestions with existing data
        const newCategory = suggestions.core.length > 0 ? suggestions.core.join(", ") : product.category;
        const newVibes = suggestions.vibes.length > 0 ? suggestions.vibes.join(", ") : product.vibe_category;
        const newMoods = suggestions.moods.length > 0 ? suggestions.moods.join(", ") : product.mood;

        const { error: updateError } = await supabase
          .from("products")
          .update({
            category: newCategory,
            vibe_category: newVibes,
            mood: newMoods,
          })
          .eq("id", product.id);

        if (updateError) {
          console.error(`Failed to update ${product.name}:`, updateError);
          results.push({ id: product.id, name: product.name, status: "error", suggestions });
        } else {
          // Handle keywords - upsert each keyword and link to product
          if (suggestions.keywords.length > 0) {
            for (const term of suggestions.keywords) {
              // Get or create keyword
              let { data: existing } = await supabase
                .from("keywords")
                .select("id")
                .eq("term", term)
                .maybeSingle();

              let keywordId: string;
              if (existing) {
                keywordId = existing.id;
              } else {
                const { data: created } = await supabase
                  .from("keywords")
                  .insert({ term })
                  .select("id")
                  .single();
                if (!created) continue;
                keywordId = created.id;
              }

              // Link keyword to product (ignore duplicates)
              await supabase
                .from("product_keywords")
                .upsert({ product_id: product.id, keyword_id: keywordId }, { onConflict: "product_id,keyword_id", ignoreDuplicates: true });
            }
          }

          results.push({ id: product.id, name: product.name, status: "updated", suggestions });
          console.log(`Updated: ${product.name} → categories: ${newCategory}, vibes: ${newVibes}, moods: ${newMoods}`);
        }

        // Small delay between requests
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`Error processing ${product.name}:`, err);
        results.push({ id: product.id, name: product.name, status: "error" });
      }
    }

    const updated = results.filter(r => r.status === "updated").length;
    const failed = results.filter(r => r.status === "error").length;

    return new Response(JSON.stringify({ 
      message: `Processed ${products.length} products: ${updated} updated, ${failed} failed`,
      updated,
      failed,
      results 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Batch suggest error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
