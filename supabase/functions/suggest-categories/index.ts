import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { name, description, price, source_url, vendor_name, company_name } = JSON.parse(body);

    // Brand-specific category hints from brand_lookup table
    const vendorHints = await getBrandHint(supabase, source_url, vendor_name);

    const moodList = Object.entries(MOOD_CATEGORIES)
      .map(([mood, anchors]) => `- ${mood}: ${anchors}`)
      .join("\n");

    const prompt = `You are a product tagging assistant for a curated affiliate shopping platform called Mood and Vibes. Your job is to analyze a product and return structured JSON assigning it to the right categories, vibes, moods, and keywords.

═══════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════

Return ONLY raw JSON. No markdown, no explanation, no code fences.

{
  "core": ["subcategory-slug"],
  "vibes": ["vibe name"],
  "moods": ["mood name"],
  "keywords": ["long-tail keyword phrase"],
  "confidence": 0.92
}

ASSIGNMENT LIMITS — strictly enforced:
- core: exactly 1 value
- vibes: 1–2 values maximum
- moods: 1–2 values maximum
- keywords: 6–10 values

Use exact category/vibe/mood names from these lists:
CORE CATEGORIES: ${CORE_CATEGORIES.join(", ")}
VIBE CATEGORIES: ${VIBE_CATEGORIES.join(", ")}
MOOD CATEGORIES:
${moodList}

═══════════════════════════════════════
VIBE DEFINITIONS
═══════════════════════════════════════

Assign vibes based on these definitions. Never assign a vibe that does not match. When in doubt between two, pick the stronger match only.

THE ATELIER
Luxury, artisan, or investment pieces. Designer brands, handcrafted items. Signals connoisseurship and craftsmanship. The choice of someone who buys fewer things but better things.

OLD MONEY
Quiet luxury. Understated, classic, heritage materials. No logos, no flash. Timeless over trendy. Linen, cashmere, neutral palette. The aesthetic of wealth that does not need to announce itself.

EFFORTLESS CHIC
Elevated but wearable. Looks put-together without trying. Relaxed silhouettes in quality fabrics. Accessible luxury. The French-girl aesthetic applied to any category.

STREET STYLE
Trend-forward, urban, culturally fluent. Do NOT treat this as a low-price vibe — street style spans all price points. A $600 hype drop and a $40 vintage find both qualify. The signal is cultural currency, not cost. Hip-hop, pop, skate, and sneaker culture all live here.

SPORTY GIRL
Performance meets lifestyle. Activewear worn beyond the gym. Elevated athletic aesthetic. Clean, functional, aspirational. The product looks as good in a coffee shop as in a workout.

OFF DUTY
Between sporty and chic. Elevated basics, comfortable but styled. The outfit — or object — for someone who is not trying but still looks good. Model-off-duty energy.

COZY HOMEBODY
Comfort-first. Products for staying in intentionally. Soft textures, warm tones, enveloping materials. Candles, knit blankets, loungewear, weighted everything. The vibe of a Sunday that never ends.

MAIN CHARACTER
Bold, statement-making, conversation-starting. The thing people notice first. Dressing — or decorating — for the plot. More theatrical than Aura Farming, less chaotic than Hot Mess.

HOT MESS
Unapologetically chaotic. Clashing colours, mixed prints, maximalist layering — worn or displayed with full confidence. The aesthetic is the point. Distinguished from Eccentric Maximalist by being more spontaneous than deliberate.

ECCENTRIC MAXIMALIST
Theatrical and deliberate. Heavy embellishment, sculptural silhouettes, unexpected material combinations. High-fashion chaos with clear intentionality and craft. Think Comme des Garçons or Iris Apfel. Distinguished from Hot Mess by intentionality.

DOPAMINE HITS
Joy through color and form. The product exists to create an immediate emotional lift for its owner regardless of audience. A saturated cobalt vase, a cherry red Dutch oven, a sunshine yellow notebook. The color IS the value proposition. Applies equally to fashion, home, kitchen, and stationery. Inward-facing joy — not about how others see you.

AURA FARMING
Attention through mystique rather than volume. Cool, modern, slightly untouchable presence. The person — or space — that everyone notices but cannot explain why. Pop star and music video energy off-stage. Often minimal or monochrome with one unexpected element. Outward-facing and social — about the signal projected, not the feeling created. Distinct from Main Character which is dramatic; Aura Farming is magnetic.

SOFT ACADEMIA
The romance of intellectual and creative life. Curiosity, craft, and the feeling of a well-loved study or studio. Tweed, plaid, leather accessories, warm lighting, books, stationery, wooden desk objects, loose-leaf tea. NOT limited to fashion — this is one of the most cross-category vibes on the platform. A leather notebook, a reading lamp, a set of art pencils, or a vintage globe all qualify.

═══════════════════════════════════════
MOOD DEFINITIONS
═══════════════════════════════════════

Moods describe how a product makes its owner feel when using or wearing it. Assign based on the emotional register of the product, not its category.

CALM
Serene, unhurried. Products that reduce friction or create stillness. Spa energy. Neutral palette. The feeling of a deep breath.

COZY
Warm, enveloping, soft. Sensory comfort. Makes you want to stay in. Autumn and winter energy but not exclusively seasonal.

BOLD
Confident, high contrast, commanding. Strong shapes, strong colours, strong statements. The product that changes the energy of a room or outfit.

PLAYFUL
Fun, lighthearted, unexpected. Products with wit or whimsy. Bright, unusual forms. The product that makes people smile when they see it.

MINIMAL
Stripped back, purposeful, no excess. Clean lines. Products where less is clearly more. The beauty is in what has been removed.

ROMANTIC
Soft, sensory, intimate. Florals, candlelight, fine materials. Gifting energy. Products associated with connection and feeling.

FOCUSED
Purposeful and task-oriented. Products that help you build, make, fix, or create something with your hands or mind. Workshop tools, studio equipment, precision instruments, productivity objects. Not about aesthetics — about doing.

MOTIVATED
High energy, achievement-oriented, driven. Products associated with self-improvement, performance, and getting things done. Fitness gear, goal-setting tools, workspace upgrades. The product that makes you want to start.

═══════════════════════════════════════
KEYWORD RULES
═══════════════════════════════════════

Keywords power SEO and AI discovery. Quality over quantity.

NEVER return:
- Broad category names (e.g. "men's watch", "women's top", "kitchen item")
- Standalone specs (e.g. "stainless steel", "43mm", "water resistant") — these belong in the Specifications field
- The product's own brand name as a keyword
- Single-word tags

ALWAYS return:
- Long-tail phrases of 2–5 words that describe style, material combined with form, occasion combined with intent, or cultural vibe
- Phrases that answer: what would someone actually type into Google to find this exact product?
- Intent-driven phrases: "anniversary gift for him", "quiet luxury desk accessory", "soft academia reading lamp"
- Style/aesthetic phrases: "bauhaus minimalist watch", "oversized boyfriend fit knit", "cottagecore ceramic mug"

Return 6–10 keywords. Each should be something a real person would search.

═══════════════════════════════════════
CATEGORY-BASED MOOD DEFAULTS
═══════════════════════════════════════

When a product's core category is identifiable, use these defaults as a starting mood assignment. Override the default only when the product description, name, or price provides a stronger signal.

The Essentials (everyday-goods)
→ Default mood: Calm or Minimal
→ Override if: product has strong color or gift signal → Playful

The Hobbyist — Crafting & DIY (crafting-diy)
→ Default mood: Focused or Playful
→ Use Focused for precision tools and equipment
→ Use Playful for arts, crafts, and creative supplies

The Hobbyist — Gaming (gaming)
→ Default mood: Playful or Bold
→ Use Bold for high-performance or competitive gear
→ Use Playful for casual, colorful, or novelty gaming items

The Hobbyist — Fitness & Sports (fitness)
→ Default mood: Motivated
→ Override if: recovery or wellness product → Calm

The Jewel Box (jewel-box)
→ Default mood: Romantic or Calm
→ Use Romantic for gifting context or fine jewelry
→ Use Calm for understated, minimal jewelry and accessories

The Look — Fashion (all fashion subcategories)
→ No default — derive mood entirely from product signals, image, and material keywords. Fashion mood is too varied for a category default.

The Nest (kids-family)
→ Default mood: Cozy or Playful
→ Use Playful for kids and toys
→ Use Cozy for baby, nursery, and parenting products

The Pantry (kitchen-dining)
→ Default mood: Cozy
→ Override if: strong color signal → Dopamine Hits vibe, Bold or Playful mood

The Sanctuary (home-living)
→ Default mood: Calm or Cozy
→ Use Calm for décor, lighting, and artwork
→ Use Cozy for textiles, candles, and soft furnishings
→ Override if: strong saturated color → Dopamine Hits vibe

The Setup (tech-gadgets)
→ Default mood: Minimal or Focused
→ Use Minimal for clean desk setups, sleek devices, understated tech
→ Use Focused for productivity tools, multi-monitor setups, studio equipment
→ Do NOT default to Bold — tech mood should feel purposeful, not loud

The Vanity (beauty-wellness)
→ Default mood: Calm or Romantic
→ Use Calm for skincare, wellness, and body care
→ Use Romantic for fragrance, fine beauty tools, and gifting
→ Override if: bold makeup or editorial product → Bold

The Voyage (travel-leisure)
→ Default mood: Motivated or Playful
→ Use Motivated for performance outdoor gear and luggage
→ Use Playful for travel accessories and leisure items

The Workshop (the-workshop)
→ Default mood: Focused
→ Do NOT assign Bold — workshop products are about doing, not showing. Override only if the product has clear gift-worthy or aesthetic signals → Minimal

IMPORTANT: These are starting positions, not locked assignments. A product in The Pantry with a deep moody palette and artisan craft signal should override Cozy with Calm and pick up Soft Academia vibe. Use judgment when signals conflict with defaults.

═══════════════════════════════════════
PRICE-BASED VIBE RULES
═══════════════════════════════════════

Price is a strong vibe signal. Apply these rules before other signals, then allow material, brand, and visual signals to override when they conflict.

$1,000 and above
→ Strongly lean toward: The Atelier
→ Exception: if product is tech or tools with no luxury signal, price alone does not assign The Atelier — use category mood defaults instead
→ Exception: if product is clearly mass-market brand at unusually high price, treat as no signal

$500–$999
→ With luxury brand OR premium material signal (cashmere, silk, leather, hand-crafted, limited edition):
  → Assign: The Atelier or Old Money
→ Without luxury signal:
  → Treat as neutral, let other signals decide

$200–$499 (fashion category only)
→ Lean toward: Effortless Chic
→ Override if: strong material or aesthetic signal points elsewhere (e.g. athletic → Sporty Girl, bold color → Dopamine Hits)

$80–$199
→ No price-based vibe default
→ Let category, material, and visual signals decide entirely

Under $80 (fashion category only)
→ Do NOT auto-assign Street Style based on price alone
→ Street Style is a cultural signal, not a price bracket — a $40 item can be Street Style if it has the right aesthetic signals, and a $60 item can be Effortless Chic
→ Treat as neutral and let other signals decide

Any price — activewear or fitness category
→ Assign: Sporty Girl or Off Duty
→ Use Sporty Girl for performance-first products
→ Use Off Duty for lifestyle-athletic crossover products

Any price — strong single saturated color as primary selling point
→ Consider: Dopamine Hits vibe regardless of price tier
→ Applies to fashion, home, kitchen, and stationery equally

PRICE TIER SUMMARY TABLE:
$1000+    → The Atelier (fashion/luxury/accessories)
$500-999  → The Atelier or Old Money (with luxury signal)
$200-499  → Effortless Chic (fashion default)
$80-199   → No default, signals decide
Under $80 → No default, signals decide
Any price + activewear → Sporty Girl or Off Duty
Any price + bold color → Dopamine Hits consideration

═══════════════════════════════════════
MATERIAL & AESTHETIC SIGNAL RULES
═══════════════════════════════════════

When these terms appear in the product name, description, or keywords — in any form, including partial matches — apply the corresponding vibe and mood signals. These override category defaults but can be overridden by price and brand rules when they conflict.

─────────────────────────────────────
THE ATELIER signals
─────────────────────────────────────
Material terms: cashmere, nappa leather, silk, hand-stitched, hand-crafted, patchwork, artisan, bespoke, couture, lambskin, suede, python, crocodile, shearling, bouclé, duchess satin
→ Vibe: The Atelier
→ Mood: Calm or Romantic

─────────────────────────────────────
OLD MONEY / EFFORTLESS CHIC signals
─────────────────────────────────────
Material terms: linen, cotton twill, unstructured, relaxed fit, heritage, classic cut, natural fiber, stone-washed, raw edge, wide-leg, tailored, merino
Style terms: minimal hardware, tonal, monochrome, neutral, understated, clean line
→ Vibe: Old Money (if price $300+) or Effortless Chic (if price under $300)
→ Mood: Calm or Minimal

─────────────────────────────────────
STREET STYLE signals
─────────────────────────────────────
Style terms: oversized, vintage-wash, graphic, drop-shoulder, distressed, raw hem, graffiti, logo-heavy, colorblock, patchwork denim, cargo, utility
Cultural terms: hype, limited drop, collab, streetwear, skate, bmx, sneaker, basketball
→ Vibe: Street Style (regardless of price)
→ Mood: Bold or Playful

─────────────────────────────────────
SPORTY GIRL / OFF DUTY signals
─────────────────────────────────────
Material terms: compression, moisture-wicking, performance, ribbed, seamless, recycled nylon, spandex, lycra, mesh panel, four-way stretch, breathable, quick-dry
Style terms: racerback, sports bra, legging, bike short, windbreaker, track, athletic
→ Vibe: Sporty Girl (performance focus) or Off Duty (lifestyle crossover)
→ Mood: Motivated or Playful

─────────────────────────────────────
COZY HOMEBODY signals
─────────────────────────────────────
Material terms: sherpa, fleece, waffle knit, terry cloth, lounge, fuzzy, plush, slipper, robe, weighted
Style terms: oversized fit, relaxed, loungewear, sleepwear, pajama, hoodie, sweatshirt
→ Vibe: Cozy Homebody
→ Mood: Cozy

─────────────────────────────────────
ECCENTRIC MAXIMALIST signals
─────────────────────────────────────
Material terms: feather trim, sequin, beaded, rhinestone, embellished, metallic, holographic, velvet (in fashion context)
Style terms: sculptural, avant-garde, exaggerated silhouette, theatrical, oversized volume, deconstructed, asymmetric
→ Vibe: Eccentric Maximalist
→ Mood: Bold

─────────────────────────────────────
DOPAMINE HITS signals
─────────────────────────────────────
Color terms (as primary selling point): cobalt, electric blue, cherry red, sunshine yellow, fuchsia, tangerine, hot pink, grass green, neon, vivid, saturated, pop of color, statement color
Object context: colorful cookware, bright stationery, vivid home accessory where color is clearly the product differentiator
→ Vibe: Dopamine Hits
→ Mood: Playful or Bold

─────────────────────────────────────
AURA FARMING signals
─────────────────────────────────────
Style terms: editorial, cool-girl, understated statement, monochrome with detail, considered, architectural, precise
Cultural terms: model off-duty, fashion week, pop star, music video, avant-pop, clean girl (elevated version)
→ Vibe: Aura Farming
→ Mood: Calm or Bold
→ Note: Aura Farming is outward-facing. If the product creates joy for the owner privately → Dopamine Hits. If it creates presence socially → Aura Farming.

─────────────────────────────────────
SOFT ACADEMIA signals
─────────────────────────────────────
Material terms (fashion): tweed, plaid, corduroy, wool blazer, beret, oxfords, loafer, leather satchel, cable knit
Object terms (non-fashion): notebook, stationery, fountain pen, art supplies, reading lamp, leather journal, bookend, globe, magnifying glass, botanical print, wooden desk accessory, loose-leaf tea, ceramic mug (in study/library context)
Color palette: warm browns, forest green, burgundy, cream, mustard, aged ivory
→ Vibe: Soft Academia
→ Mood: Focused or Romantic
→ IMPORTANT: Apply this to home, stationery, and kitchen products, not only fashion. A leather-bound journal qualifies as strongly as a tweed blazer.

─────────────────────────────────────
MAIN CHARACTER signals
─────────────────────────────────────
Style terms: statement piece, showstopper, conversation piece, all eyes on, scene-stealing, one-of-a-kind, eye-catching, centerpiece (for home products)
→ Vibe: Main Character
→ Mood: Bold
→ Use when the product is clearly designed to be the focal point of an outfit or room — not just colorful or unusual, but specifically dominant

─────────────────────────────────────
SIGNAL CONFLICT RESOLUTION
─────────────────────────────────────
When multiple signals point to different vibes, use this priority order:
1. Brand signal (if strong and unambiguous)
2. Price signal (for The Atelier specifically)
3. Material signal (most specific material wins)
4. Style/aesthetic signal
5. Category default

Maximum 2 vibes and 2 moods regardless of how many signals are present. If three vibes are equally signaled, pick the two that are most differentiated from each other.

═══════════════════════════════════════
BRAND SIGNAL RULES
═══════════════════════════════════════

The company_name field provides brand context. Use it as a categorical signal, not a lookup table — reason about the brand type rather than matching specific names.

─────────────────────────────────────
LUXURY & INDEPENDENT DESIGNER brands
─────────────────────────────────────
Signals: brand is a known luxury house, independent fashion designer, or artisan maker. Often single-name or founder-named brands. Products typically $200+.
→ Vibe lean: The Atelier or Old Money
→ Confirm with price signal — if price is under $100 despite luxury brand name, treat brand signal as weak
→ Examples of brand type (not exhaustive): single-name European fashion houses, independent New York or LA designers, Japanese craft brands

─────────────────────────────────────
PERFORMANCE & ATHLETIC brands
─────────────────────────────────────
Signals: brand is known primarily for sportswear, athletic gear, outdoor performance, or fitness equipment. Applies regardless of price point.
→ Vibe lean: Sporty Girl or Off Duty
→ Mood lean: Motivated
→ Override only if the specific product is clearly a lifestyle/fashion crossover with no performance function
→ Brand types: running brands, yoga/studio brands, outdoor performance brands, gym equipment brands, athletic footwear

─────────────────────────────────────
STREETWEAR & HYPE brands
─────────────────────────────────────
Signals: brand operates in hype, drop, or streetwear culture. Associated with limited releases, collaborations, sneaker culture, or music/artist affiliations. Price is irrelevant — do NOT limit Street Style to low price points.
→ Vibe lean: Street Style
→ Mood lean: Bold or Playful
→ Brand types: skate brands, sneaker brands, music-affiliated fashion labels, hype-adjacent streetwear

─────────────────────────────────────
MASS MARKET brands
─────────────────────────────────────
Signals: brand is widely distributed, high volume, broadly accessible. No strong aesthetic or cultural identity signal.
→ No vibe default from brand alone
→ Fall back entirely to price, material, and category signals
→ Brand types: large retail chains, fast fashion brands, general merchandise brands

─────────────────────────────────────
BEAUTY & WELLNESS brands
─────────────────────────────────────
Signals: brand specializes in skincare, cosmetics, haircare, fragrance, or wellness products.
→ Vibe lean: none by default — too varied within beauty
→ Mood lean: Calm (skincare/wellness) or Romantic (fragrance/fine beauty)
→ Exception: if brand is known for bold editorial makeup → Bold mood

─────────────────────────────────────
HOME & LIFESTYLE brands
─────────────────────────────────────
Signals: brand specializes in home décor, kitchen, or lifestyle objects.
→ If brand is known for colorful, design-forward products (e.g. Le Creuset-type brands) → Dopamine Hits vibe
→ If brand is known for minimalist Scandinavian or Japanese design → Minimal mood, Old Money or Effortless Chic vibe
→ If brand is known for artisan or craft objects → Soft Academia or The Atelier vibe

─────────────────────────────────────
BRAND SIGNAL PRIORITY
─────────────────────────────────────
Brand signals are strong but not absolute. Override brand signal when:
- The specific product clearly contradicts the brand's typical aesthetic
- Price strongly conflicts with brand tier
- Material signals are more specific than brand category

Brand signal + price signal agreement = high confidence.
Brand signal + material signal agreement = high confidence.
Brand signal alone = moderate confidence, confirm with at least one other signal.

Product Name: ${name || "Unknown"}
Brand: ${company_name || "Unknown"}
${vendorHints}Description: ${description || "No description"}
Price: $${price || "Unknown"}

CONFIDENCE SCORE: Include a "confidence" field (0.0–1.0). Score higher when brand context strongly matched (0.85+), product description is specific and detailed (+0.1), category choice is unambiguous (+0.1). Score lower when no brand match, vague description, or multiple equally valid categories.`;

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
    const validKeywords = dedupeStrings((suggestions.keywords || []).map((k: string) => k.toLowerCase().trim())).slice(0, 12);
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
