import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_INSTRUCTION = `You are a product description rewriter for an affiliate discovery site.

Rewrite the given product description into a descriptive prose that balances functional clarity with a creative editorial voice.

RULES:
- Target 4-5 sentences or a short paragraph plus a feature list. Minimum 100 words, maximum 180 words.
- Output clean HTML only: <p>, <ul>, <li>. No <html>, <body>, <h1>-<h6>, no markdown, no code fences.
- Lead with what the product IS and what it DOES. No bridge phrases ("Introducing", "Discover", "Experience").
- Write with descriptive precision — use material, texture, construction, and use-context details to create a clear picture of the object. Avoid vague filler.
- Utility-first but not sterile. The prose should be considered and editorial, not clinical or list-only.
- Strip marketing superlatives ("amazing", "revolutionary", "perfect", "ultimate") and replace with specific details.
- Never mention price, value, cost, deals, savings, or affordability.
- Never fabricate specifications, materials, dimensions, or claims not present in the source.
- No drug/medical/cosmetic-claim language (treats, heals, repairs, stimulates collagen, anti-aging, reduces wrinkles, cures, etc.).
- If the source contains a feature list, render it as a <ul> of <li> items after the opening paragraph.
- Preserve brand and product names exactly as written.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_DESCRIPTION_LENGTH = 5000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Require a valid Supabase session
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
    const { description } = await req.json();

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

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: description }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 1000 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "Gemini API request failed." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.toString() ?? "";

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
