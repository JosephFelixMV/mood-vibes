// supabase/functions/rewrite-description/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_INSTRUCTION = `You are a product description editor for Mood & Vibes, a curated discovery platform. 
Your task is to transform marketing copy into an architectural, utility-first narrative that remains strictly factual.

REQUIRED STRUCTURE (3-4 SENTENCES):
1. THE FOUNDATION: Identify the object precisely (garment, skincare, furniture, etc.) and define it as a "versatile lifestyle element" designed for a "high-performance experience."
2. THE COMPOSITION: Detail the core materials, ingredients, or technologies present in the source text. Describe these as establishing a "sophisticated and resilient environment" for the user. 
3. THE UTILITY: Explain the object’s functional performance and how it acts as a "precision-driven decorative anchor" to streamline a specific maintenance, styling, or usage process.

STRICT CONSTRAINTS:
- RETAIN all technical facts (dimensions, percentages, specific ingredients). Do not omit or invent data.
- REFRAME tone from emotive "sales-speak" to "curated precision." Use sophisticated, objective language.
- ZERO bridge phrases: Strictly avoid "You'll love," "Since you," or any user-directed language.
- NO FABRICATION: Do not make health, performance, or skin claims not explicitly stated in the source.
- OUTPUT: Clean HTML using only <p>, <ul>, <li>, and <strong>. No markdown or code blocks.`;

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
