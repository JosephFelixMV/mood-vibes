import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sub-categories (ones with parent_slug) from the categories table
const CORE_CATEGORIES = [
  "Beauty", "Automotive", "Cleaning", "Garden", "Health", "Office",
  "Fashion", "Men's Fashion", "Women's Fashion", "Home", "Accessories",
  "Handbags", "Jewelry", "Watches", "Men's Watches", "Women's Watches",
  "Baby", "Family", "Kids", "Kitchen", "Books", "Fitness", "Gaming",
  "Pets", "Toys", "Electronics", "Tech", "Hand Tools", "Power Tools",
  "Tool Accessories", "Outdoors", "Travel"
];

const VIBE_CATEGORIES = [
  "Bloom & Glow", "Build Mode", "Dress to Impress", "Drip & Shine",
  "Eclectic Maximalist", "Geek & Gamer", "Little Ones", "Organized Life",
  "Quiet Luxury", "Soft Academia", "Sporty Clean Girl", "Sustainable Futurism",
  "The Wellness Era", "Urban Tech-Wear", "Whimsigoth", "Work-From-Anywhere"
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const { name, description, price } = JSON.parse(body);

    const prompt = `You are a product categorization assistant. Given a product, select the most fitting categories.

CORE CATEGORIES (pick 1-3 that best fit):
${CORE_CATEGORIES.join(", ")}

VIBE CATEGORIES (pick 0-4 that best fit the product's aesthetic/vibe):
${VIBE_CATEGORIES.join(", ")}

Product Name: ${name || "Unknown"}
Description: ${description || "No description"}
Price: ${price || "Unknown"}

Respond ONLY with valid JSON in this exact format, no other text:
{"core": ["Category1", "Category2"], "vibes": ["Vibe1", "Vibe2"]}

Use exact category names from the lists above. Pick categories that genuinely fit.`;

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
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON in response");
    }
    
    const suggestions = JSON.parse(jsonMatch[0]);
    
    // Validate against actual category names
    const validCore = (suggestions.core || []).filter((c: string) => CORE_CATEGORIES.includes(c)).slice(0, 3);
    const validVibes = (suggestions.vibes || []).filter((v: string) => VIBE_CATEGORIES.includes(v)).slice(0, 4);

    console.log("Suggestions:", { core: validCore, vibes: validVibes });

    return new Response(JSON.stringify({ core: validCore, vibes: validVibes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error suggesting categories:", error);
    return new Response(JSON.stringify({ core: [], vibes: [], error: String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
