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

// Legal compliance: strip drug-territory / medical-claim language from keywords.
// Benign uses ("treat jar", "home repair tool", "remove makeup") are intentionally NOT matched.
const DRUG_TERRITORY_PATTERNS: RegExp[] = [
  /\banti[-\s]?aging\b/i,
  /\b(reduces?|reduce)\s+(fine\s+lines?|wrinkles?|inflammation|redness|appearance\s+of\s+(?:\d+\s+)?wrinkles?|signs?\s+of\s+aging|expression\s+lines?|dark\s+circles?|visible\s+lines?|acne\s+scars?|oiliness)\b/i,
  /\b(removes?|eliminates?)\s+(wrinkles?|fine\s+lines?|cellulite|dark\s+circles?|age\s+spots?)\b/i,
  /\b(prevents?)\s+(aging|wrinkles?|fine\s+lines?|breakouts?|nail\s+splitting)\b/i,
  /\b(repairs?)\s+(skin|damage|cells?|barrier)\b/i,
  /\b(skin|nail|barrier|damage|cellular|wrinkle)\s+repair\b/i,
  /\bnighttime?\s+(skin\s+)?repair\b/i,
  /\bintensive\s+foot\s+repair\b/i,
  /\bage\s+defense\b/i,
  /\bserum\s+to\s+reduce\b/i,
  /\b(treats?|heals?|cures?|reverses?)\s+(acne|skin|aging|wrinkles?|damage|dryness|condition|disease|inflammation|infection)/i,
  /\b(stimulates?|boosts?|builds?)\s+collagen\b/i,
  /\bcollagen\s+production\b/i,
  /\bdetoxif(?:y|ies|ying)\b/i,
  /\b(alleviates?|soothes?\s+pain|pain\s+relief|joint\s+pain|fat[-\s]?burning|cellulite\s+removal)\b/i,
  /\b(clinically|dermatologist)[-\s]proven\b/i,
  /\bFDA[-\s]approved\b/i,
  /\b(miracle|guaranteed\s+results)\b/i,
  /\bboosts?\s+immunity\b/i,
];

function isDrugTerritory(keyword: string): boolean {
  return DRUG_TERRITORY_PATTERNS.some((re) => re.test(keyword));
}

export function stripDrugTerritory(keywords: string[]): string[] {
  return keywords.filter((k) => !isDrugTerritory(k));
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
  const { data } = await sb.from("categories").select("name, type, description, parent_slug").order("name");
  const rows = data || [];

  const core = rows.filter((r: any) => r.type === "core" && r.parent_slug).map((r: any) => r.name);

  const vibes = rows.filter((r: any) => r.type === "vibe").map((r: any) => r.name);

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
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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
- keywords: 4–6 values

Use exact category/vibe/mood names from these lists:
CORE CATEGORIES: ${CORE_CATEGORIES.join(", ")}
VIBE CATEGORIES: ${VIBE_CATEGORIES.join(", ")}
MOOD CATEGORIES:
${moodList}

═══════════════════════════════════════
VIBE DEFINITIONS
═══════════════════════════════════════

Assign vibes based on these definitions. Never assign a vibe that does not match. When in doubt between two, pick the stronger match only.

The Atelier
Luxury, artisan, or investment pieces. Designer brands, handcrafted items. Signals connoisseurship and craftsmanship. The choice of someone who buys fewer things but better things.

Quiet Luxury
Understated, classic, heritage materials. No logos, no flash. Timeless over trendy. Linen, cashmere, neutral palette. The aesthetic of wealth that does not need to announce itself.

Minimal and Casual
Elevated but wearable. Looks put-together without trying. Relaxed silhouettes in quality fabrics. Accessible luxury. The French-girl aesthetic applied to any category.

Drip & Shine
High-end shine. Bold jewelry, statement accessories, and pieces that add gleam and presence to any look. Gold chains, bold earrings, standout bags, and pieces that elevate an outfit through shine and quality. The flex is in what catches the eye.

Get Sporty
Performance meets lifestyle. Activewear worn beyond the gym. Elevated athletic aesthetic. Clean, functional, aspirational. The product looks as good in a coffee shop as in a workout.

Off-Duty Model
Between sporty and chic. Elevated basics, comfortable but styled. The outfit — or object — for someone who is not trying but still looks good. Model-off-duty energy.

Stay-In Cinema
Comfort-first. Products for staying in intentionally. Soft textures, warm tones, enveloping materials. Candles, knit blankets, loungewear, weighted everything. The vibe of a Sunday that never ends.

Dress to Impress
Bold, statement-making, conversation-starting. The thing people notice first. Dressing — or decorating — for the plot. More theatrical than Aura Farming, less chaotic than Hot Mess Express.

Hot Mess Express
Unapologetically chaotic. Clashing colours, mixed prints, maximalist layering — worn or displayed with full confidence. The aesthetic is the point. Distinguished from Eclectic Maximalist by being more spontaneous than deliberate.

Eclectic Maximalist
Theatrical and deliberate. Heavy embellishment, sculptural silhouettes, unexpected material combinations. High-fashion chaos with clear intentionality and craft. Think Comme des Garçons or Iris Apfel. Distinguished from Hot Mess Express by intentionality.

Dopamine Hits
Joy through color and form. The product exists to create an immediate emotional lift for its owner regardless of audience. A saturated cobalt vase, a cherry red Dutch oven, a sunshine yellow notebook. The color IS the value proposition. Applies equally to fashion, home, kitchen, and stationery. Inward-facing joy — not about how others see you.

Aura Farming
Streetwear cool factor. Effortless city style with hoodies, cargos, clean sneakers, and the cultural fluency that makes it all land without trying. The aesthetic of someone who just gets it without being loud about it. Understated cool over flashy.

Soft Academia
The romance of intellectual and creative life. Curiosity, craft, and the feeling of a well-loved study or studio. Tweed, plaid, leather accessories, warm lighting, books, stationery, wooden desk objects, loose-leaf tea. NOT limited to fashion — this is one of the most cross-category vibes on the platform. A leather notebook, a reading lamp, a set of art pencils, or a vintage globe all qualify.

Ballin' on a Budget
Great style and finds at accessible price points. Savvy shopping, high-low mixing, deals that look expensive. The flex is getting it for less.

Bloom & Glow
Fresh, feminine, nature-inspired. Florals, soft pastels, skincare rituals, garden aesthetics. Spring energy all year round. Products that feel alive and nurturing.

Build & Maintain
Practical ownership and upkeep. Tools, home maintenance, DIY projects, organised garages and workshops. The satisfaction of fixing and building things yourself.

Coastal Cool
Relaxed beach-town aesthetic without being literal. Linen, washed blues, natural textures, sun-faded palette. Laid-back but considered. More surf town than resort wear.

Content Creator Kit
Products for building a personal brand, studio setup, or online presence. Ring lights, desk setups, cameras, microphones, aesthetic backgrounds. Creating as a lifestyle.

Corporate Core
Sharp, professional, put-together. Office-ready fashion and workspace products. The aesthetic of someone who takes their career seriously. Quiet ambition.

Going Out Era
Dressed for the night out. Sequins, heels, statement bags, elevated going-out looks. The ritual of getting ready and the products that make it happen.

In My Zone
Deep focus and flow state. Noise-cancelling headphones, productivity setups, ambient tools. Products for people who do their best work alone.

Jet Set
Travel as a lifestyle aesthetic. Luggage, passport holders, travel accessories, airport-ready fashion. The look of someone who is always on the way somewhere interesting.

Kitchen Flex
Elevated cooking and food culture. Statement cookware, premium ingredients, kitchen gadgets, hosting setups. Cooking as self-expression and social currency.

Little Ones
Products for babies, toddlers, and young children. Gifting for new parents, nursery aesthetics, developmental toys. The joy and chaos of early childhood.

Organized Life
Systems, storage, and the satisfaction of everything in its place. Label makers, drawer organisers, planners, clean aesthetic storage solutions.

Pet Parent Life
Products for people whose pets are family. Elevated pet accessories, treats, beds, toys. The aesthetic of a home where animals are very welcome.

Pure Routine
Skincare, wellness, and self-care rituals. The products that make up a morning or evening routine. Consistency and the small daily investments in yourself.

Sneakerheads
Sneaker culture and streetwear adjacent footwear. Limited releases, classics, care products. Both the collector and the casual wearer who takes shoes seriously.

The Wellness Era
Health-conscious living. Supplements, fitness recovery, sleep products, mindfulness tools, clean beauty. The lifestyle upgrade toward feeling better.

Tis the Season
Seasonal and holiday products. Christmas, Hanukkah, Halloween, Valentine's Day, Easter. Gifting, decorating, and celebrating. Time-sensitive and occasion-driven.

Touch Grass
Outdoors, nature, and getting away from screens. Hiking gear, camping, gardening, outdoor living. The antidote to too much time inside.

Whimsigoth
Playful dark aesthetic. Celestial motifs, crystals, dark florals, Halloween-adjacent decor that stays year-round. Not aggressively gothic — more witchy cottage core.

Backyard Social
High-energy outdoor entertaining. Grilling, smoking, and hosting in the backyard. The products of the person who takes their BBQ seriously. Cast iron, smokers, grill tools, outdoor kitchen setups, fire pits, and competitive lawn games. Loud, social, and savory.

Al Fresco
Effortless outdoor relaxation. The lighter, breezier side of being outside — lounging, picnicking, and garden living. Linen, string lights, hammocks, melamine dinnerware, outdoor cushions, and portable speakers in a garden context. Calm and unhurried.

Work-From-Anywhere
Home office and remote work setup. Ergonomic chairs, desk accessories, cable management, aesthetic workspaces. Products for people whose office is wherever they are.

Homebody
The aesthetic of an intentional living space. Botanicals and planters, ceramic objects, candles, home fragrance, diffusers, ambient lighting, decorative vessels. Products that make a home feel curated rather than furnished. Distinct from Cozy — this is about the visual and sensory environment of the space, not comfort or softness.

IMPORTANT: Always use the exact vibe name as listed above when returning suggestions. The name must match exactly — including capitalisation, apostrophes, hyphens, and ampersands — because it is matched against the database. For example: "Drip & Shine" not "Drip and Shine", "Off-Duty Model" not "Off Duty Model", "Hot Mess Express" not "Hot Mess", "Backyard Social" not "Backyard Social BBQ", "Al Fresco" not "Alfresco".

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
- DRUG-TERRITORY / MEDICAL-CLAIM LANGUAGE (legal compliance — strictly prohibited):
  Never use verbs or phrases that imply medical efficacy, structural change to the body, or treatment of a condition. This applies to keywords, descriptions, and any output text.
  Forbidden verbs/phrases include (non-exhaustive): treats, heals, cures, repairs (skin/damage/cells), reverses, stimulates collagen, boosts collagen, builds collagen, removes wrinkles, removes fine lines, eliminates wrinkles, reduces wrinkles, reduces inflammation, reduces redness, prevents aging, anti-aging, anti aging, fights aging, fights wrinkles, detoxifies, detox, alleviates, soothes pain, pain relief, joint pain, fat burning, cellulite removal, clinically proven, dermatologist proven, FDA approved, miracle, guaranteed results, boosts immunity.
  Compliant alternatives — describe APPEARANCE, FEEL, or RITUAL only:
    "anti-aging serum"        → "smoothing serum" or "youthful-looking skin serum"
    "reduces fine lines"      → "helps minimize the appearance of fine lines"
    "skin repair cream"       → "nourishing skin cream"
    "removes wrinkles"        → "wrinkle-smoothing"
    "stimulates collagen"     → "supports a plump, dewy look"
    "treats acne"             → "for blemish-prone skin"
    "heals dry skin"          → "hydrating dry skin balm"
  RULE: If you cannot rephrase a benefit cosmetically, OMIT it. Never invent medical claims.

ALWAYS return:
- Long-tail phrases of 2–5 words that describe style, material combined with form, occasion combined with intent, or cultural vibe
- Phrases that answer: what would someone actually type into Google to find this exact product?
- Intent-driven phrases: "anniversary gift for him", "quiet luxury desk accessory", "soft academia reading lamp"
- Style/aesthetic phrases: "bauhaus minimalist watch", "oversized boyfriend fit knit", "cottagecore ceramic mug"

GIFTING TAGS (IMPORTANT):
- Whenever the product is plausibly giftable (most are), include AT LEAST ONE "gift for ..." phrase among the 6 tags.
- Examples: "gift for home chef", "gift for new homeowner", "gift for coffee lover", "gift for him", "gift for her", "gift for new mom".
- Pick the recipient that best matches the product's actual use case. Do not invent unrelated audiences.

Return 4–6 keywords (one of which should be a "gift for ..." phrase when applicable). Each should be something a real person would search.

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

Homebody (homebody)
→ Default mood: Calm
→ Override if: fragrance-forward product → Romantic
→ Override if: strong saturated color → Playful

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
  → Assign: The Atelier or Quiet Luxury
→ Without luxury signal:
  → Treat as neutral, let other signals decide

$200–$499 (fashion category only)
→ Lean toward: Minimal and Casual
→ Override if: strong material or aesthetic signal points elsewhere (e.g. athletic → Get Sporty, bold color → Dopamine Hits)

$80–$199
→ No price-based vibe default
→ Let category, material, and visual signals decide entirely

Under $80 (fashion category only)
→ Do NOT auto-assign Drip & Shine based on price alone
→ Drip & Shine is a cultural signal, not a price bracket — a $40 item can be Drip & Shine if it has the right aesthetic signals, and a $60 item can be Minimal and Casual
→ Treat as neutral and let other signals decide

Any price — activewear or fitness category
→ Assign: Get Sporty or Off-Duty Model
→ Use Get Sporty for performance-first products
→ Use Off-Duty Model for lifestyle-athletic crossover products

Any price — strong single saturated color as primary selling point
→ Consider: Dopamine Hits vibe regardless of price tier
→ Applies to fashion, home, kitchen, and stationery equally

PRICE TIER SUMMARY TABLE:
$1000+    → The Atelier (fashion/luxury/accessories)
$500-999  → The Atelier or Quiet Luxury (with luxury signal)
$200-499  → Minimal and Casual (fashion default)
$80-199   → No default, signals decide
Under $80 → No default, signals decide
Any price + activewear → Get Sporty or Off-Duty Model
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
QUIET LUXURY / MINIMAL AND CASUAL signals
─────────────────────────────────────
Material terms: linen, cotton twill, unstructured, relaxed fit, heritage, classic cut, natural fiber, stone-washed, raw edge, wide-leg, tailored, merino
Style terms: minimal hardware, tonal, monochrome, neutral, understated, clean line
→ Vibe: Quiet Luxury (if price $300+) or Minimal and Casual (if price under $300)
→ Mood: Calm or Minimal

─────────────────────────────────────
DRIP & SHINE signals
─────────────────────────────────────
Style terms: oversized, vintage-wash, graphic, drop-shoulder, distressed, raw hem, graffiti, logo-heavy, colorblock, patchwork denim, cargo, utility
Cultural terms: hype, limited drop, collab, streetwear, skate, bmx, sneaker, basketball
→ Vibe: Drip & Shine (regardless of price)
→ Mood: Bold or Playful

─────────────────────────────────────
GET SPORTY / OFF-DUTY MODEL signals
─────────────────────────────────────
Material terms: compression, moisture-wicking, performance, ribbed, seamless, recycled nylon, spandex, lycra, mesh panel, four-way stretch, breathable, quick-dry
Style terms: racerback, sports bra, legging, bike short, windbreaker, track, athletic
→ Vibe: Get Sporty (performance focus) or Off-Duty Model (lifestyle crossover)
→ Mood: Motivated or Playful

─────────────────────────────────────
STAY-IN CINEMA signals
─────────────────────────────────────
Material terms: sherpa, fleece, waffle knit, terry cloth, lounge, fuzzy, plush, slipper, robe, weighted
Style terms: oversized fit, relaxed, loungewear, sleepwear, pajama, hoodie, sweatshirt
→ Vibe: Stay-In Cinema
→ Mood: Cozy

─────────────────────────────────────
ECLECTIC MAXIMALIST signals
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
HOMEBODY signals
─────────────────────────────────────
Object terms: succulent, cactus, orchid, planter, ceramic vase, botanical print, beeswax candle, scented candle, home fragrance, diffuser, reed diffuser, room spray, pillow mist, ambient lamp, decorative object, terrarium, dried flowers
→ Vibe: Homebody
→ Mood: Calm or Romantic
→ Note: Use Romantic for fragrance-forward products (perfumed candles, reed diffusers, room sprays). Use Calm for visual/decorative objects (planters, ceramics, vessels).

─────────────────────────────────────
QUIET LUXURY signals
─────────────────────────────────────
Material terms: cashmere, merino, silk, linen, leather, suede, camel, ivory,
cream, stone, sand, tailored, unstructured, relaxed fit, wide-leg, straight cut
Style terms: no logo, logoless, understated, tonal dressing, monochrome,
neutral palette, clean silhouette, heritage, classic, timeless
Price signal: $200+ with neutral palette and quality material = strong Quiet Luxury
Brand signal: known heritage or quiet designer brands
→ Vibe: Quiet Luxury
→ Mood: Calm or Minimal
→ IMPORTANT: Quiet Luxury is logoless and understated. If the product has visible
branding, logos, or flash → do NOT assign. Distinguish from The Atelier
(which is artisan/investment) — Quiet Luxury is about restraint, not craft.

─────────────────────────────────────
MINIMAL AND CASUAL signals
─────────────────────────────────────
Material terms: cotton, jersey, linen, relaxed fit, easy wear, everyday,
washed, soft, lightweight, breathable
Style terms: effortless, simple, clean, unfussy, wardrobe staple, everyday
essential, goes-with-everything, versatile, capsule wardrobe
Price signal: $50–$250 range, accessible luxury feel
→ Vibe: Minimal and Casual
→ Mood: Minimal or Calm
→ Note: This is the approachable version of Quiet Luxury. Similar materials
but lower price point and less intentional dressing. French-girl energy —
looks good without appearing to try.
→ Distinguish from Quiet Luxury: if price is under $200 and brand has no
luxury signal → Minimal and Casual over Quiet Luxury

─────────────────────────────────────
DRIP & SHINE signals
─────────────────────────────────────
Object terms: gold chain, necklace, bracelet, earrings,
rings, statement jewelry, bold accessories, designer bag,
embellished bag, rhinestone, crystal accessories,
pearl jewelry, layered jewelry, chunky jewelry,
statement sunglasses, luxury watch, charm bracelet
Style terms: high-end accessories, statement piece,
jewelry stack, elevated accessories, shine, gleam,
bold finish, luxe detail, eye-catching accessories
→ Vibe: Drip & Shine
→ Mood: Bold or Romantic
→ Distinguish from Aura Farming: Drip & Shine is
specifically accessories and jewelry that shine and pop.
Aura Farming is the overall streetwear look and cool factor.
→ Distinguish from The Atelier: Drip & Shine is bold
and statement-making. The Atelier is quiet artisan luxury.

─────────────────────────────────────
DRESS TO IMPRESS signals
─────────────────────────────────────
Style terms: statement, bold silhouette, occasion wear, cocktail, formal,
elevated, dressed up, going out, evening, party, gala, event, special
occasion, standout, turn heads, dressed for the moment
Material terms: satin, chiffon, velvet, embellished, sequin (less chaotic
than Eclectic Maximalist), structured, tailored formal
Color terms: jewel tones, rich colors, deep red, emerald, navy, black,
metallic, gold, silver
Object terms: blazers, tailored suits, statement heels, formal bags,
structured clutch, cocktail dress, evening gown
→ Vibe: Dress to Impress
→ Mood: Bold or Romantic
→ Distinguish from Eclectic Maximalist: Dress to Impress is polished and
occasion-driven. Eclectic Maximalist is theatrical and deliberate.
→ Distinguish from Going Out Era: Dress to Impress is formal/occasion.
Going Out Era is nightlife/social.

─────────────────────────────────────
HOT MESS EXPRESS signals
─────────────────────────────────────
Style terms: clashing prints, mixed patterns, bold color clash, maximalist
layering, unexpected combinations, mismatched, eclectic mix, fearless,
unapologetic, rule-breaking, chaotic styling
Color terms: multiple bold colors worn together, pattern mixing, print clash,
neon with florals, stripes with animal print
→ Vibe: Hot Mess Express
→ Mood: Playful or Bold
→ Distinguish from Eclectic Maximalist: Hot Mess Express is spontaneous
and joyfully chaotic. Eclectic Maximalist is deliberate high-fashion chaos
with clear intentionality. If the product description uses craft or
design-forward language → Eclectic Maximalist. If it is just wild and fun →
Hot Mess Express.

─────────────────────────────────────
BLOOM & GLOW signals
─────────────────────────────────────
Material terms: floral print, botanical print, petal, garden, rose,
wildflower, soft pastel, blush, peach, lilac, sage, mint, feminine,
delicate, soft texture, natural ingredients, botanical extract
Style terms: feminine, romantic silhouette, soft drape, garden party,
spring, fresh, nurturing, alive, blooming
Object terms: floral skincare, botanical beauty, garden accessories,
pressed flower objects, soft floral homeware, spring table setting
→ Vibe: Bloom & Glow
→ Mood: Romantic or Playful
→ Note: Applies across fashion, beauty, and home. A floral face serum,
a garden-print dress, and a botanical candle all qualify.
→ Distinguish from Homebody: Bloom & Glow is floral and feminine-forward.
Homebody is about the curated living space regardless of florals.

─────────────────────────────────────
BUILD & MAINTAIN signals
─────────────────────────────────────
Object terms: hand tools, power tools, drill, saw, screwdriver, wrench,
hammer, level, tape measure, toolbox, workbench, storage system,
garage organiser, workshop supply, safety equipment, paint, primer,
caulk, hardware, fasteners, ladder, pressure washer
Style terms: durable, heavy duty, professional grade, reliable,
precision, ergonomic grip, long-lasting
Brand signal: known tool brands (DeWalt, Milwaukee, STIHL, Craftsman,
Garrett Wade)
→ Vibe: Build & Maintain
→ Mood: Focused
→ Note: Garrett Wade qualifies despite being premium/artisan — the
function is still building and maintaining. The aesthetic quality
lifts the vibe signal but does not change it.

─────────────────────────────────────
COASTAL COOL signals
─────────────────────────────────────
Material terms: linen, cotton canvas, rope, rattan, jute, washed denim,
natural fiber, sun-faded, weathered, bleached, chambray, terry cloth
(in beach/outdoor context)
Color terms: washed blue, sandy beige, off white, sun-bleached white,
seafoam, driftwood, warm neutrals, ocean tones
Style terms: relaxed, laid-back, effortless, beach town, surf-adjacent,
nautical without being literal, sun-soaked, breezy
Object terms: linen shirts, canvas totes, rattan accessories,
beach towel, sun hat, woven bag, outdoor furniture in natural materials,
coastal table setting
→ Vibe: Coastal Cool
→ Mood: Calm or Playful
→ IMPORTANT: Coastal Cool is a lived-in aesthetic, not resort wear.
Avoid assigning to formal beach or luxury resort products → those
belong in Quiet Luxury or The Atelier.

─────────────────────────────────────
GOING OUT ERA signals
─────────────────────────────────────
Style terms: going out, night out, club, bar, dinner, date night,
girls night, party, social, festive, glam, dressed up casual,
after dark, elevated casual evening
Material terms: satin, mesh, bodycon, mini, crop, strappy, backless,
cutout, wrap, slip dress, cami, tube
Object terms: going out top, mini skirt, bodycon dress, strappy heels,
statement earrings, chain bag, glam makeup, party makeup,
bold lip, shimmer
Color terms: black, deep jewel tones, red, hot pink, metallic, gold
→ Vibe: Going Out Era
→ Mood: Bold or Playful
→ Distinguish from Dress to Impress: Going Out Era is nightlife and
social occasions — more casual, youthful energy. Dress to Impress is
formal events and occasions where polish matters most.

─────────────────────────────────────
JET SET signals
─────────────────────────────────────
Style terms: travel, airport style, packing, carry-on, on the go,
frequent flyer, globetrotter, destination, adventure-ready,
travel-ready, wanderlust
Object terms: luggage, carry-on, passport holder, travel wallet,
packing cube, travel pillow, neck pillow, eye mask, noise cancelling
headphones (in travel context), travel adapter, weekender bag,
duffel, travel organiser, travel-size beauty
Brand signal: known luggage and travel brands
→ Vibe: Jet Set
→ Mood: Motivated or Playful
→ Note: Jet Set is about the lifestyle of movement, not just the
destination. Airport-ready fashion also qualifies alongside
travel accessories.

─────────────────────────────────────
KITCHEN FLEX signals
─────────────────────────────────────
Object terms: cookware, cast iron, Dutch oven, skillet, saucepan,
knife, chef knife, cutting board, mixing bowl, stand mixer,
food processor, baking sheet, roasting pan, mortar and pestle,
kitchen scale, cookbook, apron, kitchen gadget, espresso machine,
coffee maker, French press, premium ingredients, hosting setup,
serving board, charcuterie board, wine glasses, cocktail tools
Style terms: elevated cooking, premium kitchen, chef-inspired,
entertaining, hosting, dinner party, food culture
Brand signal: Our Place, Material, Lenox, Ooni, Weber, Solo Stove
→ Vibe: Kitchen Flex
→ Mood: Playful or Cozy
→ Note: Kitchen Flex is cooking as self-expression and social currency.
The product should feel aspirational — not just functional. A basic
non-stick pan is not Kitchen Flex. An enameled cast iron Dutch oven is.

─────────────────────────────────────
ORGANIZED LIFE signals
─────────────────────────────────────
Object terms: storage box, drawer organiser, label maker, planner,
notebook, calendar, desk organiser, cable management, shelf divider,
bin, basket, acrylic organiser, closet system, pantry organiser,
spice rack, file organiser, tray, container set, stackable storage
Style terms: clean, systematic, everything in its place,
satisfying organisation, aesthetic storage, matching set,
colour-coordinated storage, clutter-free
Brand signal: The Container Store, simplehuman-type brands
→ Vibe: Organized Life
→ Mood: Minimal or Calm
→ Note: The aesthetic matters — plain cardboard boxes are not
Organized Life. The storage solution should look good while
functioning well.
→ Distinguish from Work From Anywhere: if the product is specifically
workspace-oriented → Work From Anywhere. If it is general home
organisation → Organized Life.

─────────────────────────────────────
PURE ROUTINE signals
─────────────────────────────────────
Object terms: cleanser, moisturiser, serum, toner, SPF, sunscreen,
eye cream, retinol, vitamin C, hyaluronic acid, face mask,
sheet mask, facial oil, essence, mist, micellar water,
exfoliant, AHA, BHA, body lotion, body oil, hand cream,
lip treatment, nail care, shampoo, conditioner, hair mask,
hair oil, scalp treatment, body wash, bath soak, bath oil
Style terms: routine, ritual, daily, morning routine, evening routine,
skincare routine, self-care, consistent, step, regimen
Brand signal: dermatologist-recommended brands, clean beauty brands,
Sephora and Ulta-carried skincare brands
→ Vibe: Pure Routine
→ Mood: Calm
→ Note: Pure Routine is about the daily investment in self. Products
should feel like part of a considered regimen — not one-off treatments
or spa indulgences (those lean Bloom & Glow or The Wellness Era).

─────────────────────────────────────
THE WELLNESS ERA signals
─────────────────────────────────────
Object terms: supplement, vitamin, collagen, protein powder,
greens powder, adaptogen, probiotic, omega, magnesium,
sleep aid, melatonin, wellness shot, functional beverage,
fitness tracker, yoga mat, foam roller, massage gun,
resistance band, recovery tool, meditation journal,
gratitude journal, wellness book, air purifier, water filter,
blue light glasses
Style terms: health-conscious, clean living, holistic,
gut health, mental wellness, recovery, longevity,
clean ingredients, functional, evidence-based
→ Vibe: The Wellness Era
→ Mood: Calm or Motivated
→ Use Motivated for fitness recovery and performance tools
→ Use Calm for sleep, mindfulness, and mental wellness products
→ Distinguish from Pure Routine: Pure Routine is topical skincare
and beauty. The Wellness Era is ingestible, fitness, and holistic health.

─────────────────────────────────────
TIS THE SEASON signals
─────────────────────────────────────
Object terms: Christmas ornament, advent calendar, wrapping paper,
ribbon, gift tag, stocking, garland, wreath, tree decoration,
menorah, dreidel, Halloween decoration, pumpkin, candle
(holiday scented), holiday card, Easter basket, Valentine gift,
seasonal tableware, holiday hosting, festive serving ware,
fire pit, outdoor heater, chiminea, log basket,
fireplace accessories, hot chocolate set, mulled wine set,
weighted blanket (seasonal context), thermal flask, hand warmer,
cosy outdoor living
Style terms: seasonal, holiday, festive, gifting, celebrating,
limited edition holiday, special occasion, christmas, halloween,
valentines, easter, hanukkah, thanksgiving, autumnal,
winter warmth, seasonal living, cosy season
→ Vibe: Tis the Season
→ Mood: Playful or Cozy
→ Note: Applies to products that define a season or create seasonal
atmosphere — not just holiday-branded items. A fire pit that anchors
autumn outdoor living qualifies as strongly as a Christmas ornament.
Use judgment — the product should feel distinctly tied to a time of year.

─────────────────────────────────────
TOUCH GRASS signals
─────────────────────────────────────
Object terms: hiking boots, trail running shoes, backpack,
tent, sleeping bag, camping stove, headlamp, trekking poles,
water bottle (outdoor context), carabiner, gardening gloves,
trowel, seeds, planter (outdoor), outdoor furniture, hammock,
kayak, paddleboard, bike, cycling gear, surfboard, wetsuit,
outdoor blanket
Style terms: outdoor, nature, trail, off-grid, sustainable,
durable, weatherproof, all-terrain, adventure, wilderness
Brand signal: performance outdoor brands, garden brands
→ Vibe: Touch Grass
→ Mood: Motivated or Playful
→ Distinguish from Coastal Cool: Touch Grass is active outdoor
pursuit — hiking, camping, gardening, adventure. Coastal Cool
is the aesthetic of coastal living without necessarily being active.
→ Distinguish from Get Sporty: Touch Grass is nature and outdoors
specifically. Get Sporty is gym and athletic performance.

─────────────────────────────────────
WHIMSIGOTH signals
─────────────────────────────────────
Material terms: velvet (dark), black lace, dark florals,
moon motif, star motif, celestial print, crystal,
amethyst, obsidian, tarot, mushroom, butterfly (dark),
dried botanicals, dark botanical print,
black candle, wax seal, gothic calligraphy
Color terms: black, deep purple, forest green, dark burgundy,
midnight blue, aged gold, rust, dark terracotta
Style terms: witchy, gothic-adjacent, celestial, mystical,
cottagecore dark, halloween-adjacent year-round,
moody, enchanted, folklore
Object terms: crystal, tarot deck, spell candle,
moon phase print, celestial jewelry, dark floral vase,
gothic home accent, incense, altar object,
star map, constellation print
→ Vibe: Whimsigoth
→ Mood: Playful or Bold
→ IMPORTANT: Whimsigoth is playful dark — not aggressively
gothic or horror-adjacent. The aesthetic is witchy cottage
core, not heavy metal. Dark florals and celestial motifs
qualify strongly. Skulls and gore do not.

─────────────────────────────────────
WORK FROM ANYWHERE signals
─────────────────────────────────────
Object terms: standing desk, monitor stand, laptop stand,
desk lamp, ergonomic chair, keyboard, mouse, mousepad,
webcam, ring light, microphone, headset, cable management,
power strip, USB hub, laptop bag, desk plant,
desk organiser (in workspace context), whiteboard,
sticky notes, notebook (in workspace context)
Style terms: home office, remote work, work from home,
WFH, desk setup, workspace aesthetic, productivity,
ergonomic, focus environment, aesthetic workspace
→ Vibe: Work From Anywhere
→ Mood: Focused or Minimal
→ Use Focused for productivity and ergonomic tools
→ Use Minimal for clean aesthetic desk setups
→ Distinguish from In My Zone: Work From Anywhere is
about the physical workspace setup. In My Zone is about
the mental state of deep focus — flow state products.
→ Distinguish from Organized Life: if the product is
specifically workspace-oriented → Work From Anywhere.
If it is general home organisation → Organized Life.


─────────────────────────────────────
BACKYARD SOCIAL signals
─────────────────────────────────────
Object terms: grill, smoker, BBQ, charcoal, cast iron,
outdoor kitchen, fire pit, patio heater, lawn game,
cornhole, brisket, ribs, apron, tongs, grill brush,
smoker box, propane, BBQ rub, marinade, cooler,
charcuterie board (outdoor), Weber, Traeger,
Big Green Egg, Solo Stove
Style terms: heavy duty, professional grade, outdoor
entertaining, hosting, gathering, backyard, social,
smoky, grilling, pitmaster, competition BBQ
→ Vibe: Backyard Social
→ Mood: Bold or Social
→ Distinguish from Touch Grass: Touch Grass is outdoor
adventure and nature. Backyard Social is outdoor hosting
and entertaining in a fixed space.
→ Distinguish from Tis the Season: Backyard Social is
year-round outdoor entertaining, not seasonally defined.
→ Distinguish from Kitchen Flex: Kitchen Flex is indoor
cooking culture. Backyard Social is specifically outdoor
and social.

─────────────────────────────────────
AL FRESCO signals
─────────────────────────────────────
Object terms: picnic basket, picnic blanket, hammock,
outdoor rug, garden chair, patio umbrella, shade sail,
string lights, lantern, citronella candle, mosquito
repellent, outdoor cushion, melamine dinnerware,
acrylic glassware, portable speaker (outdoor context),
bocce ball, badminton, bubble machine, garden table,
inflatable pool lounger
Material terms: linen, cotton canvas, rattan, woven,
natural fiber, lightweight, shatterproof, bamboo
Style terms: picnic, garden, patio, shaded, lounging,
breezy, airy, al fresco, outdoor living, summer
afternoon, effortless outdoor, laid-back, relaxed
→ Vibe: Al Fresco
→ Mood: Calm or Playful
→ Distinguish from Coastal Cool: Coastal Cool has a
beach or water reference. Al Fresco is garden, patio,
or countryside.
→ Distinguish from Touch Grass: Touch Grass is active
outdoor pursuit. Al Fresco is stationary and relaxed.
→ Distinguish from Backyard Social: Backyard Social is
high-energy grilling and hosting. Al Fresco is
low-energy lounging and picnicking.

─────────────────────────────────────
AURA FARMING signals
─────────────────────────────────────
Style terms: streetwear, cool factor, understated,
effortless style, cultural currency, clean aesthetic,
low-key flex, city cool, minimal streetwear
Object terms: hoodies, cargo pants, caps, clean sneakers,
oversized tees, joggers, bucket hats, crossbody bags
Cultural terms: hype-adjacent, culturally fluent,
cool without trying, effortless cool, street credibility
→ Vibe: Aura Farming
→ Mood: Bold or Minimal
→ Distinguish from Drip & Shine: Aura Farming is the
overall cool streetwear aesthetic and cultural signal.
Drip & Shine is specifically high-end jewelry and statement
accessories that add shine and pop to any look.
→ Distinguish from Dress to Impress: Aura Farming is
casual and effortless. Dress to Impress is occasion-driven
and polished.

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
DRESS TO IMPRESS signals
─────────────────────────────────────
Style terms: statement piece, showstopper, conversation piece, all eyes on, scene-stealing, one-of-a-kind, eye-catching, centerpiece (for home products)
→ Vibe: Dress to Impress
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
→ Vibe lean: The Atelier or Quiet Luxury
→ Confirm with price signal — if price is under $100 despite luxury brand name, treat brand signal as weak
→ Examples of brand type (not exhaustive): single-name European fashion houses, independent New York or LA designers, Japanese craft brands

─────────────────────────────────────
PERFORMANCE & ATHLETIC brands
─────────────────────────────────────
Signals: brand is known primarily for sportswear, athletic gear, outdoor performance, or fitness equipment. Applies regardless of price point.
→ Vibe lean: Get Sporty or Off-Duty Model
→ Mood lean: Motivated
→ Override only if the specific product is clearly a lifestyle/fashion crossover with no performance function
→ Brand types: running brands, yoga/studio brands, outdoor performance brands, gym equipment brands, athletic footwear

─────────────────────────────────────
STREETWEAR & HYPE brands
─────────────────────────────────────
Signals: brand operates in hype, drop, or streetwear culture. Associated with limited releases, collaborations, sneaker culture, or music/artist affiliations. Price is irrelevant — do NOT limit Drip & Shine to low price points.
→ Vibe lean: Drip & Shine
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
→ If brand is known for minimalist Scandinavian or Japanese design → Minimal mood, Quiet Luxury or Minimal and Casual vibe
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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const content = await callAnthropic({
      apiKey: ANTHROPIC_API_KEY,
      user: prompt,
      maxTokens: 1024,
      temperature: 0.3,
    });

    console.log("AI raw response:", content.substring(0, 500));

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON in response");
    }

    const suggestions = JSON.parse(jsonMatch[0]);

    const moodNames = Object.keys(MOOD_CATEGORIES);
    let validCore = dedupeStrings((suggestions.core || []).filter((c: string) => CORE_CATEGORIES.includes(c))).slice(
      0,
      5,
    );
    let validVibes = dedupeStrings((suggestions.vibes || []).filter((v: string) => VIBE_CATEGORIES.includes(v))).slice(
      0,
      4,
    );
    let validMoods = dedupeStrings((suggestions.moods || []).filter((m: string) => moodNames.includes(m))).slice(0, 3);
    const rawKeywords = dedupeStrings((suggestions.keywords || []).map((k: string) => k.toLowerCase().trim()));
    const compliantKeywords = stripDrugTerritory(rawKeywords);
    const validKeywords = capKeywordsPreservingGiftFor(compliantKeywords, 6);
    const confidence =
      typeof suggestions.confidence === "number" ? Math.min(1, Math.max(0, suggestions.confidence)) : 0.6;

    // Auto-assign "The Atelier" vibe and "Luxe" mood for fashion items over $1000
    const FASHION_CATEGORIES = [
      "Women's Fashion",
      "Men's Fashion",
      "Women's Shoes",
      "Men's Shoes",
      "Activewear",
      "Accessories",
      "Bags & Totes",
      "Jewelry",
      "Watches",
      "Eyewear",
    ];
    const parsedPrice = typeof price === "number" ? price : parseFloat(String(price));
    const isFashion = validCore.some((c: string) => FASHION_CATEGORIES.includes(c));
    if (isFashion && parsedPrice >= 1000) {
      if (!validVibes.includes("The Atelier")) validVibes = ["The Atelier", ...validVibes].slice(0, 4);
      if (!validMoods.includes("Luxe")) validMoods = ["Luxe", ...validMoods].slice(0, 3);
    }

    // Auto-assign "Pure Routine" vibe for skincare/wellness/beauty routine products
    const PURE_ROUTINE_CATEGORIES = [
      "Skin Care",
      "Hair Care",
      "Body Care",
      "Beauty Tools & Devices",
      "Health & Wellness",
      "Fragrance",
    ];
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
    const FRESH_START_CATEGORIES = ["Cleaning & Utility", "Office & Stationery"];
    const isFreshStart = validCore.some((c: string) => FRESH_START_CATEGORIES.includes(c));
    if (isFreshStart && !validMoods.includes("Fresh Start")) {
      validMoods = [...validMoods, "Fresh Start"].slice(0, 3);
    }

    validVibes = dedupeStrings(validVibes).slice(0, 4);
    validMoods = dedupeStrings(validMoods).slice(0, 3);

    console.log("Suggestions:", {
      core: validCore,
      vibes: validVibes,
      moods: validMoods,
      keywords: validKeywords,
      confidence,
    });

    return new Response(
      JSON.stringify({ core: validCore, vibes: validVibes, moods: validMoods, keywords: validKeywords, confidence }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error suggesting categories:", error);
    return new Response(JSON.stringify({ core: [], vibes: [], moods: [], error: String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
