import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

const dedupeStrings = (values: string[] = []) => {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

async function getBrandHint(sb: any, sourceUrl?: string, vendorName?: string): Promise<string> {
  const url = (sourceUrl || "").toLowerCase();
  const name = (vendorName || "").toLowerCase().trim();
  if (!url && !name) return "";

  // Try URL match first
  const { data: byUrl } = await sb
    .from("brand_lookup")
    .select("core, vibes, moods, hint, brand")
    .neq("url_match", "")
    .limit(100);

  const urlMatch = (byUrl || []).find((r: any) => r.url_match && url.includes(r.url_match));
  if (urlMatch) return formatBrandHint(urlMatch);

  // Fall back to alias match
  const { data: byAlias } = await sb
    .from("brand_lookup")
    .select("core, vibes, moods, hint, brand")
    .contains("match_aliases", [name]);

  if (byAlias?.[0]) return formatBrandHint(byAlias[0]);

  return "";
}

function formatBrandHint(row: any): string {
  const parts = [];
  if (row.hint) parts.push(`Brand context: ${row.hint}`);
  if (row.core?.length) parts.push(`Typical core categories for this brand: ${row.core.join(", ")}`);
  if (row.vibes?.length) parts.push(`Typical vibes for this brand: ${row.vibes.join(", ")}`);
  if (row.moods?.length) parts.push(`Typical moods for this brand: ${row.moods.join(", ")}`);
  return parts.length ? `\nBRAND CONTEXT:\n${parts.join("\n")}\n` : "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { core: CORE_CATEGORIES, vibes: VIBE_CATEGORIES, moods: MOOD_CATEGORIES } = await loadCategories(supabase);

    const body = await req.text();
    const { name, description, price, source_url, vendor_name } = JSON.parse(body);

    // Brand-specific category hints from brand_lookup table
    const vendorHints = await getBrandHint(supabase, source_url, vendor_name);

    const moodList = Object.entries(MOOD_CATEGORIES)
      .map(([mood, anchors]) => `- ${mood}: ${anchors}`)
      .join("\n");

    const prompt = `You are a product tagging assistant for a curated affiliate shopping platform.
Your job is to return structured JSON with four keys: core, vibes, moods, keywords.

CORE CATEGORIES (pick 1-5 that best fit):
${CORE_CATEGORIES.join(", ")}

VIBE CATEGORIES (pick 0-4 that best fit the product's aesthetic/vibe):
${VIBE_CATEGORIES.join(", ")}

MOOD CATEGORIES (pick 1-3 that best describe the feeling/emotion this product evokes):
${moodList}

KEYWORD RULES — this is the most important part:
1. NEVER return broad category terms as keywords (e.g. "men's watch", "luxury watch", "women's top"). These are category names, not tags.
2. NEVER return generic specs as keywords (e.g. "stainless steel", "43mm", "water resistant"). These belong in the Specifications field, not keywords.
3. Generate keywords across FIVE dimensions. Cover as many as genuinely apply:

   A) Product type – literal item descriptors with style/material qualifiers:
      e.g. "bauhaus minimalist watch", "heavyweight french terry hoodie", "brushed titanium case watch"

   B) Mood + Vibe – aesthetic and feeling keywords:
      e.g. "quiet luxury accessories", "old money aesthetic watch", "cottagecore kitchen decor"

   C) Recipient persona – who the product suits:
      - Gender signals: "gift for him", "gift for her", "gender neutral gift"
      - Life stage: "gift for new mom", "gift for teen girl", "gift for dad"
      - Relationship: "gift for partner", "gift for best friend", "gift for coworker"

   D) Personality & lifestyle – defining interests of the ideal buyer:
      e.g. "for fitness lovers", "homebody essentials", "gift for bookworm",
      "wellness obsessed", "outdoorsy gift", "for minimalists", "plant parent gift"

   E) Occasion & intent – when and why someone buys it:
      e.g. "birthday gift for her", "treat yourself", "self care gift",
      "housewarming gift", "mothers day gift", "valentines day for him",
      "graduation gift", "just because gift", "new year reset"

   Optional — Age bracket (only when clearly applicable from product context):
      e.g. "gift for her in her 20s", "young professional essentials", "40s style upgrade"

4. Return 8–12 keywords. Each should be 2–6 words. Think: what would someone actually type into Google to find this exact product or gift?
5. For fashion products, also include seasonal/warmth signals where applicable:
   - Materials like "wool", "cashmere", "puffer", "fleece" → include them in keyword phrases, not standalone
   - e.g. "chunky wool turtleneck sweater", "lightweight linen summer blouse"

DISAMBIGUATION:
- Personal fragrance (perfume, cologne, body mist) → use "Fragrance" core.
  Candles, diffusers, room spray → use "Candles & Home Fragrance". Never confuse these.
- "Aura Farming" vibe = cinematic main character energy, effortless status,
  leather, chrome, oversized tailored, polarized sunglasses. NOT spiritual/crystals
  (that is "Whimsigoth"). NOT understated old-money (that is "Quiet Luxury").

Product Name: ${name || "Unknown"}
${vendorHints}Description: ${description || "No description"}
Price: ${price || "Unknown"}

CONFIDENCE SCORE: Include a "confidence" field (0.0–1.0). Score higher when:
brand context strongly matched (0.85+), product description is specific and
detailed (+0.1), category choice is unambiguous (+0.1). Score lower when:
no brand match, vague description, or multiple equally valid categories.

IMPORTANT: Return only raw JSON. No markdown, no explanation. Format:
{"core": ["Category1"], "vibes": ["Vibe1"], "moods": ["Mood1"], "keywords": ["long-tail keyword phrase", ...], "confidence": 0.92}

Use exact category/vibe/mood names from the lists above. Pick categories that genuinely fit.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    const rawText = await response.text();
    console.log("AI raw response:", rawText.substring(0, 500));
    
    const data = JSON.parse(rawText);
    const content = data.choices?.[0]?.message?.content || "{}";
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON in response");
    }
    
    const suggestions = JSON.parse(jsonMatch[0]);
    
    const moodNames = Object.keys(MOOD_CATEGORIES);
    let validCore = dedupeStrings((suggestions.core || []).filter((c: string) => CORE_CATEGORIES.includes(c))).slice(0, 5);
    let validVibes = dedupeStrings((suggestions.vibes || []).filter((v: string) => VIBE_CATEGORIES.includes(v))).slice(0, 4);
    let validMoods = dedupeStrings((suggestions.moods || []).filter((m: string) => moodNames.includes(m))).slice(0, 3);
    const validKeywords = dedupeStrings((suggestions.keywords || []).map((k: string) => k.toLowerCase().trim())).slice(0, 8);
    const confidence = typeof suggestions.confidence === "number"
      ? Math.min(1, Math.max(0, suggestions.confidence))
      : 0.6;

    // Auto-assign "The Atelier" vibe and "Luxe" mood for fashion items over $1000
    const FASHION_CATEGORIES = ["Women's Fashion", "Men's Fashion", "Women's Shoes", "Men's Shoes", "Activewear", "Accessories", "Bags & Totes", "Jewelry", "Watches"];
    const parsedPrice = typeof price === "number" ? price : parseFloat(String(price));
    const isFashion = validCore.some((c: string) => FASHION_CATEGORIES.includes(c));
    if (isFashion && parsedPrice >= 1000) {
      if (!validVibes.includes("The Atelier")) validVibes = ["The Atelier", ...validVibes].slice(0, 4);
      if (!validMoods.includes("Luxe")) validMoods = ["Luxe", ...validMoods].slice(0, 3);
    }

    // Auto-assign "Pure Routine" vibe for skincare/wellness/beauty routine products
    const PURE_ROUTINE_CATEGORIES = ["Skin Care", "Hair Care", "Body Care", "Beauty Tools & Devices", "Health & Wellness"];
    const isPureRoutine = validCore.some((c: string) => PURE_ROUTINE_CATEGORIES.includes(c));
    if (isPureRoutine && !validVibes.includes("Pure Routine")) {
      validVibes = [...validVibes, "Pure Routine"].slice(0, 4);
    }

    // Auto-assign "Calm" and "Summer Glow" moods for skincare/wellness/beauty products
    if (isPureRoutine) {
      if (!validMoods.includes("Calm")) validMoods = [...validMoods, "Calm"].slice(0, 3);
      if (!validMoods.includes("Summer Glow")) validMoods = [...validMoods, "Summer Glow"].slice(0, 3);
    }

    // Auto-assign "Fresh Start" mood for cleaning & organizing products
    const FRESH_START_CATEGORIES = ["Cleaning", "Office & Stationery"];
    const isFreshStart = validCore.some((c: string) => FRESH_START_CATEGORIES.includes(c));
    if (isFreshStart && !validMoods.includes("Fresh Start")) {
      validMoods = [...validMoods, "Fresh Start"].slice(0, 3);
    }

    validVibes = dedupeStrings(validVibes).slice(0, 4);
    validMoods = dedupeStrings(validMoods).slice(0, 3);

    console.log("Suggestions:", { core: validCore, vibes: validVibes, moods: validMoods, keywords: validKeywords, confidence });

    return new Response(JSON.stringify({ core: validCore, vibes: validVibes, moods: validMoods, keywords: validKeywords, confidence }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error suggesting categories:", error);
    return new Response(JSON.stringify({ core: [], vibes: [], moods: [], error: String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
