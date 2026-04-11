import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CORE_CATEGORIES = [
  "Beauty", "Automotive", "Cleaning", "Garden", "Health", "Office",
  "Fashion", "Men's Fashion", "Women's Fashion", "Home", "Accessories",
  "Handbags", "Jewelry", "Watches", "Men's Watches", "Women's Watches",
  "Baby", "Family", "Kids", "Kitchen", "Books", "Fitness & Sports", "Gaming",
  "Pets", "Toys", "Electronics", "Tech", "Hand Tools", "Power Tools",
  "Tool Accessories", "Outdoors", "Travel"
];

const VIBE_CATEGORIES = [
  "Bloom & Glow", "Build Mode", "Dress to Impress", "Drip & Shine",
  "Eclectic Maximalist", "Geek & Gamer", "Get Sporty", "Little Ones",
  "Organized Life", "Quiet Luxury", "Soft Academia", "Sustainable Futurism",
  "The Wellness Era", "Urban Tech-Wear", "Whimsigoth", "Work-From-Anywhere",
  "Tis the Season", "Sneakerheads", "Main Character Energy", "Sunday Reset",
  "Kitchen Flex", "Off-Duty Model", "In My Zone", "Coastal Cool",
  "Going Out Era", "That Girl / That Guy", "Touch Grass", "Pet Parent Life",
  "Content Creator Kit", "Corporate Core", "Jet Set", "Clean Girl / Clean Guy",
  "Stay-In Cinema", "Aura Farming", "Ballin' on a Budget", "Icy Minimal",
  "Hot Mess Express"
];

const MOOD_CATEGORIES: Record<string, string> = {
  "Cozy": "warm, soft, comfort, blankets, candles, slippers, mugs, loungewear, plush, fleece, knit",
  "Minimal": "clean, calm, uncluttered, white, simple, organizers, neutral, streamlined, scandinavian",
  "Luxe": "elevated, indulgent, rich, silk, gold, high-end, skincare, velvet, premium, designer",
  "Earthy": "grounded, natural, organic, wood, linen, clay, plants, neutral, terracotta, botanical",
  "Playful": "fun, bright, lighthearted, toys, colorful, kitchenware, novelty, quirky, cheerful, vibrant",
  "Bold": "statement, confident, bright, fashion, graphic, art, maximalist, loud, dramatic, eye-catching",
  "Calm": "soothing, de-stressing, diffusers, weighted, blankets, bath, aromatherapy, zen, peaceful, tranquil",
  "Romantic": "soft, intimate, warm, candles, lingerie, rose, flowers, date night, love, elegant",
  "Adventurous": "outdoorsy, curious, daring, camping, travel, rugged, explorer, hiking, wanderlust",
  "Festive": "celebratory, seasonal, joyful, holiday, decor, party, supplies, gift wrap, christmas, birthday",
  "Focused": "productive, clear-headed, desk, organizers, planners, workwear, office, study, concentration",
  "Summer Glow": "bright, breezy, outdoor, sunglasses, beach, swimwear, sandals, tropical, warm weather",
  "Motivated": "active, pumped, energized, gym, fitness, sports, workout, bright colors, productivity",
  "Spring Reset": "fresh, clean, pastel, renewal, decluttering, light, floral, garden, new beginnings",
  "I Love Milo": "pet, animal, dog, cat, pet beds, toys, feeding, treats, grooming",
};

async function suggestForProduct(name: string, description: string, price: number, apiKey: string) {
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
Description: ${description || "No description"}
Price: ${price || "Unknown"}

Respond ONLY with valid JSON in this exact format, no other text:
{"core": ["Category1"], "vibes": ["Vibe1"], "moods": ["Mood1"], "keywords": ["keyword1", "keyword2"]}

Use exact category/vibe/mood names from the lists above. Pick categories that genuinely fit.
For keywords, suggest 5-8 lowercase search terms shoppers might use to find this product.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    }),
  });

  const rawText = await response.text();
  const data = JSON.parse(rawText);
  const content = data.choices?.[0]?.message?.content || "{}";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");

  const suggestions = JSON.parse(jsonMatch[0]);
  const moodNames = Object.keys(MOOD_CATEGORIES);

  return {
    core: (suggestions.core || []).filter((c: string) => CORE_CATEGORIES.includes(c)).slice(0, 5),
    vibes: (suggestions.vibes || []).filter((v: string) => VIBE_CATEGORIES.includes(v)).slice(0, 4),
    moods: (suggestions.moods || []).filter((m: string) => moodNames.includes(m)).slice(0, 3),
    keywords: (suggestions.keywords || []).map((k: string) => k.toLowerCase().trim()).filter(Boolean).slice(0, 8),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const offset = body.offset || 0;
    const limit = body.limit || 10;

    // Fetch active products with pagination
    const { data: products, error: fetchError } = await supabase
      .from("products")
      .select("id, name, description, price, category, vibe_category, mood")
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
        const suggestions = await suggestForProduct(
          product.name,
          product.description || "",
          product.price,
          LOVABLE_API_KEY!
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
