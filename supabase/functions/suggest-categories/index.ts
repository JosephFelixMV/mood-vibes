import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sub-categories (ones with parent_slug) from the categories table
const CORE_CATEGORIES = [
  "Automotive", "Cleaning", "Garden", "Health & Wellness", "Office & Stationery",
  "Books", "Crafting & DIY", "Fitness & Sports", "Gaming", "Pets",
  "Accessories", "Bags & Totes", "Jewelry", "Watches",
  "Women's Fashion", "Men's Fashion", "Women's Shoes", "Men's Shoes", "Activewear",
  "Baby", "Kids", "Toys", "Parenting & Maternity",
  "Cookware & Bakeware", "Coffee & Tea", "Dining & Entertaining", "Kitchen Storage",
  "Décor & Artwork", "Textiles", "Candles & Home Fragrance", "Lighting", "Furniture",
  "Audio & Visual", "Phones & Accessories", "Smart Home", "Tech & Gadgets",
  "Skin Care", "Hair Care", "Makeup", "Body Care", "Fragrance", "Beauty Tools & Devices",
  "Luggage & Bags", "Outdoor & Camping", "Travel Essentials",
  "Hand Tools", "Power Tools", "Tool Accessories"
];

const VIBE_CATEGORIES = [
  "Bloom & Glow", "Build Mode", "Dress to Impress", "Drip & Shine",
  "Eclectic Maximalist", "Geek & Gamer", "Get Sporty", "Little Ones",
  "Organized Life", "Quiet Luxury", "Soft Academia", "Sustainable Futurism",
  "The Wellness Era", "Urban Tech-Wear", "Whimsigoth", "Work-From-Anywhere",
  "Tis the Season", "Sneakerheads", "Kitchen Flex", "Off-Duty Model",
  "In My Zone", "Coastal Cool", "Going Out Era", "Touch Grass",
  "Pet Parent Life", "Content Creator Kit", "Corporate Core", "Jet Set",
  "Stay-In Cinema", "Aura Farming", "Ballin' on a Budget",
  "Hot Mess Express", "The Atelier", "Pure Routine", "Sleek Minimal and Casual"
];

// Mood categories with anchor keywords baked in for cost-efficient AI matching.
// The descriptions serve as few-shot guidance — no extra tokens needed.
// FUTURE: At ~500+ categorized products, switch to embedding cosine similarity
// for near-zero marginal cost. Only fall back to LLM for low-confidence matches.
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
  "Fresh Start": "clean, organize, declutter, storage, bins, baskets, closet, laundry, desk, tidy, renewal, fresh, spray, supplies, recycling, dividers, marie kondo, minimalism",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const { name, description, price } = JSON.parse(body);

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
3. ALWAYS return long-tail, intent-driven keywords that describe:
   - Style / aesthetic (e.g. "bauhaus minimalist watch", "oversized boyfriend fit top")
   - Material + form (e.g. "brushed titanium case watch", "heavyweight french terry hoodie")
   - Occasion + intent (e.g. "anniversary gift watch for him", "workwear blazer for petite women")
   - Vibe / search phrase (e.g. "quiet luxury accessories", "old money aesthetic watch")
4. Return 6–8 keywords. Each should be 2–5 words. Think: what would someone actually type into Google to find this exact product?
5. For fashion products, also include seasonal/warmth signals where applicable:
   - Materials like "wool", "cashmere", "puffer", "fleece" → include them in keyword phrases, not standalone
   - e.g. "chunky wool turtleneck sweater", "lightweight linen summer blouse"

Product Name: ${name || "Unknown"}
Description: ${description || "No description"}
Price: ${price || "Unknown"}

IMPORTANT: Return only raw JSON. No markdown, no explanation. Format:
{"core": ["Category1"], "vibes": ["Vibe1"], "moods": ["Mood1"], "keywords": ["long-tail keyword phrase", ...]}

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
    
    let validCore = dedupeStrings((suggestions.core || []).filter((c: string) => CORE_CATEGORIES.includes(c))).slice(0, 5);
    let validVibes = dedupeStrings((suggestions.vibes || []).filter((v: string) => VIBE_CATEGORIES.includes(v))).slice(0, 4);
    const moodNames = Object.keys(MOOD_CATEGORIES);
    let validMoods = dedupeStrings((suggestions.moods || []).filter((m: string) => moodNames.includes(m))).slice(0, 3);
    const validKeywords = dedupeStrings((suggestions.keywords || []).map((k: string) => k.toLowerCase().trim())).slice(0, 8);

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

    console.log("Suggestions:", { core: validCore, vibes: validVibes, moods: validMoods, keywords: validKeywords });

    return new Response(JSON.stringify({ core: validCore, vibes: validVibes, moods: validMoods, keywords: validKeywords }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error suggesting categories:", error);
    return new Response(JSON.stringify({ core: [], vibes: [], moods: [], error: String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
