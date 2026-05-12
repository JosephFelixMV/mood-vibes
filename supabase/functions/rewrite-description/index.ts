import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const BANNED_PHRASES = [
  "Introducing", "Meet the", "Discover", "Experience", "Elevate your",
  "game-changer", "game changer", "revolutionary", "groundbreaking",
  "must-have", "must have", "perfect for", "ultimate", "amazing",
  "incredible", "luxurious", "premium quality", "curated", "timeless",
  "effortless", "seamlessly", "takes it to the next level",
  "Shop now", "Add to cart", "Don't miss out", "Find your mood. Shop the vibe.",
].join(", ");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_DESCRIPTION_LENGTH = 5000;

interface ProductContext {
  name?: string;
  category?: string[];
  moods?: string[];
  vibes?: string[];
  company_name?: string;
  keywords?: string[];
  fashion_season?: string;
  fashion_warmth?: string;
  fashion_occasions?: string[];
}

function buildSystemInstruction(
  product: ProductContext,
  moodCues: Record<string, string>,
  vibeCues: Record<string, string>,
): string {
  const lines: string[] = [];

  lines.push(`PERSONA & VOICE:`);
  lines.push(`- Writer persona: small-newsletter voice, half-editorial half-group-chat`);
  lines.push(`- POV: second person ("you"), singular`);
  lines.push(`- Tone: specific over breathless — name a real detail, not a feeling`);
  lines.push(``);

  lines.push(`BANNED PHRASES (never use any of these):`);
  lines.push(BANNED_PHRASES);
  lines.push(``);

  const activeMoodCues = (product.moods ?? [])
    .map((name) => ({ name, cue: moodCues[name.toLowerCase().trim()] }))
    .filter((m) => m.cue);

  const activeVibeCues = (product.vibes ?? [])
    .map((name) => ({ name, cue: vibeCues[name.toLowerCase().trim()] }))
    .filter((v) => v.cue);

  if (activeMoodCues.length > 0) {
    lines.push(`MOOD TONAL CUES (blend these — do not apply separately or sequentially):`);
    for (const { name, cue } of activeMoodCues) {
      lines.push(`- ${name}: ${cue}`);
    }
    lines.push(``);
  }

  if (activeVibeCues.length > 0) {
    lines.push(`VIBE TONAL CUES (blend with mood cues above):`);
    for (const { name, cue } of activeVibeCues) {
      lines.push(`- ${name}: ${cue}`);
    }
    lines.push(``);
  }

  if (activeMoodCues.length > 1 || activeVibeCues.length > 1) {
    lines.push(
      `When multiple mood/vibe cues are listed, blend them into a single consistent register. If cues conflict, favour the first mood listed.`,
    );
    lines.push(``);
  }

  lines.push(`OUTPUT STRUCTURE — write exactly three beats:`);
  lines.push(`1. Moment or recognition line — place the reader in a context, no sales framing`);
  lines.push(
    `2. The product plainly stated + one sensory or construction detail pulled directly from the source description (never invented)`,
  );
  lines.push(
    `3. One unexpected note — a contrast, secondary use case, or non-obvious detail from the source`,
  );
  lines.push(``);

  lines.push(`HARD RULES:`);
  lines.push(`- 100–120 words. Count matters — stay within range.`);
  lines.push(
    `- Output clean HTML: use <p> tags. Use <ul>/<li> only if the source contains a genuine feature list.`,
  );
  lines.push(
    `- Never invent specs, materials, origins, dimensions, or social proof not present in the source description`,
  );
  lines.push(`- Skip any beat where the source data is genuinely empty`);
  lines.push(`- No CTA. No summary close. No "Find your mood. Shop the vibe."`);
  lines.push(`- Preserve brand and product names exactly as written`);
  lines.push(
    `- No drug/medical/cosmetic-claim language (treats, heals, repairs, anti-aging, cures, stimulates collagen, etc.)`,
  );

  return lines.join("\n");
}

function buildUserMessage(description: string, product: ProductContext): string {
  const contextLines: string[] = [];

  if (product.name) contextLines.push(`Name: ${product.name}`);
  if (product.company_name) contextLines.push(`Brand: ${product.company_name}`);
  if (product.category?.length) contextLines.push(`Categories: ${product.category.join(", ")}`);
  if (product.moods?.length) contextLines.push(`Mood tags: ${product.moods.join(", ")}`);
  if (product.vibes?.length) contextLines.push(`Vibe tags: ${product.vibes.join(", ")}`);
  if (product.keywords?.length) contextLines.push(`Keywords: ${product.keywords.join(", ")}`);
  if (product.fashion_season) contextLines.push(`Fashion season: ${product.fashion_season}`);
  if (product.fashion_warmth) contextLines.push(`Warmth level: ${product.fashion_warmth}`);
  if (product.fashion_occasions?.length) {
    contextLines.push(`Occasions: ${product.fashion_occasions.join(", ")}`);
  }

  const contextBlock = contextLines.length
    ? `\n\nPRODUCT DATA:\n${contextLines.join("\n")}`
    : "";

  return `SOURCE DESCRIPTION:\n${description}${contextBlock}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { description, product: rawProduct } = body;
    const product: ProductContext = rawProduct ?? {};

    if (!description || typeof description !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'description' field." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Description too long (max ${MAX_DESCRIPTION_LENGTH} characters).` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch mood/vibe tonal cues from DB (same pattern as suggest-categories)
    const moodCues: Record<string, string> = {};
    const vibeCues: Record<string, string> = {};
    const hasMoodOrVibe = (product.moods?.length ?? 0) > 0 || (product.vibes?.length ?? 0) > 0;

    if (hasMoodOrVibe) {
      const { data: catRows } = await supabase
        .from("categories")
        .select("name, type, description")
        .in("type", ["mood", "vibe"]);

      for (const row of catRows ?? []) {
        if (!row.description) continue;
        const key = row.name.toLowerCase().trim();
        if (row.type === "mood") moodCues[key] = row.description;
        else if (row.type === "vibe") vibeCues[key] = row.description;
      }
    }

    const systemInstruction = buildSystemInstruction(product, moodCues, vibeCues);
    const userMessage = buildUserMessage(description, product);

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: `Gemini error ${response.status}: ${errText.slice(0, 200)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const finishReason = candidate?.finishReason ?? "unknown";
    if (finishReason !== "STOP") {
      console.warn("Gemini finishReason:", finishReason, JSON.stringify(candidate?.safetyRatings ?? []));
    }
    const raw = candidate?.content?.parts?.[0]?.text?.toString() ?? "";

    const cleaned = raw
      .replace(/^```(?:html)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    return new Response(
      JSON.stringify({ rewritten: cleaned }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("rewrite-description error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
