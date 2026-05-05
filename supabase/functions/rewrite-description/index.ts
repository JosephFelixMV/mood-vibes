// supabase/functions/rewrite-description/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_INSTRUCTION = `You are a product description rewriter for an affiliate discovery site.

Rewrite the given product description into precision-oriented functional prose.

RULES:
- Maximum 150 words.
- Output clean HTML only: <p>, <ul>, <li>. No <html>, <body>, <h1>-<h6>, no markdown, no code fences.
- Lead with what the product IS and what it DOES. No bridge phrases ("Introducing", "Discover", "Experience").
- Factual, specific, utility-first. Strip marketing superlatives ("amazing", "revolutionary", "perfect", "ultimate").
- Never fabricate specifications, materials, dimensions, or claims not present in the source.
- No drug/medical/cosmetic-claim language (treats, heals, repairs, stimulates collagen, anti-aging, reduces wrinkles, cures, etc.).
- If the source contains a feature list, render it as a <ul> of <li> items.
- Preserve brand and product names exactly as written.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { description } = await req.json();

    if (!description || typeof description !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'description' field." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: description }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "Gemini API request failed." }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    const raw =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.toString() ?? "";

    const cleaned = raw
      .replace(/^```(?:html)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    return new Response(JSON.stringify({ rewritten: cleaned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("rewrite-description error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});