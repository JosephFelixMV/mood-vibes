// supabase/functions/rewrite-description/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_INSTRUCTION = `You are a product description editor for a curated affiliate discovery platform.
Your task is to rewrite product descriptions to be factually accurate, clinically precise, and utility-first.

RULES:
1. IDENTIFY the object precisely — name what it is (garment, skincare, furniture, accessory) as a functional lifestyle element.
2. RETAIN all technical facts — materials, ingredients, dimensions, technologies, certifications. Never invent or omit factual details present in the input.
3. REFRAME tone from emotive marketing language to precision-oriented functional prose. Replace superlatives with specifics wherever possible.
4. DESCRIBE functional utility — what the object does, how it performs, what maintenance or use process it streamlines.
5. ZERO bridge phrases — never write "Since you...", "You'll love...", "Perfect for...", or any user-directed language.
6. OUTPUT clean HTML only using: <p>, <ul><li>, <strong>. No markdown. No other tags.
7. Max 3-4 sentences. Do not pad with filler sentences.
8. DO NOT fabricate any specifications, materials, or features not present in the source text.
9. DO NOT make claims about health outcomes, skin results, or performance guarantees unless those exact claims appear in the source text.`;

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { description } = await req.json();

    if (!description || description.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Description is too short to rewrite." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents: [
          {
            parts: [
              {
                text: `Rewrite the following product description according to your instructions. Return only the rewritten HTML.\n\nSOURCE TEXT:\n${description}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4, // Lower = more factual, less creative
          maxOutputTokens: 400,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemini API error:", err);
      return new Response(JSON.stringify({ error: "Gemini API request failed." }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const rewritten = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    // Strip any markdown code fences Gemini might wrap around the HTML
    const cleaned = rewritten
      .replace(/^```html\n?/i, "")
      .replace(/^```\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();

    return new Response(JSON.stringify({ rewritten: cleaned }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("rewrite-description error:", err);
    return new Response(JSON.stringify({ error: "Internal server error." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
