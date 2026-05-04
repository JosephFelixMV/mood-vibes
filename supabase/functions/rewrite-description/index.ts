// supabase/functions/rewrite-description/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_INSTRUCTION = `You are a product description editor for Mood & Vibes. 
Your task is to transform marketing copy into an architectural, utility-first narrative. 
You MUST provide a minimum of 3 distinct sentences.

EXECUTION PIPELINE:
1. SENTENCE 1 (THE IDENTITY): Identify the object precisely (e.g., garment, skincare) and define it as a "versatile lifestyle element" providing a "durable foundation for a high-performance experience."
2. SENTENCE 2 (THE COMPOSITION): Detail all technical materials, ingredients, or technologies from the source. Describe these as establishing a "sophisticated and resilient environment."
3. SENTENCE 3 (THE UTILITY): Explain the functional performance and how it acts as a "precision-driven decorative anchor" to streamline a specific maintenance or styling process.
4. SENTENCE 4 (THE FINISH): Add one final detail regarding dimensions, weight, or specific aesthetic finish (e.g., "satin finish," "75 ml format").

STRICT RULES:
- RETAIN all technical facts. Do not omit dimensions or material percentages.
- REFRAME emotive language into objective, architectural prose.
- ZERO bridge phrases like "You will love" or "Perfect for".
- OUTPUT: Clean HTML (<p>, <strong>) only. No markdown.
- DO NOT fabricate claims not present in the source text[cite: 1].`;

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
