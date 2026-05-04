// supabase/functions/rewrite-description/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_INSTRUCTION = `You are a product description editor for a curated affiliate discovery platform.
Your task is to rewrite product descriptions to be factually accurate, clinically precise, and utility-first.

RULES:
Structural Constraints
1. The Hero Statement: Every description must begin by identifying the product as a "versatile lifestyle element" or "versatile decorative element".
2. The Experience Goal: State that the product is designed to provide a "durable foundation for a high-performance [category] experience".
3. Environmental Framing: Group technical materials (e.g., Turkish wool, 18-karat gold, or botanicals) into a clause that "establishes a sophisticated and resilient environment" for the user.
4. The Functional Anchor: Conclude by defining the item as a "precision-driven decorative anchor".
5. Streamlined Utility: Explicitly mention that the product enables a "streamlined [maintenance/styling/organization] process".

Linguistic Rules
1. Nouns Over Adjectives: Replace evocative marketing adjectives (e.g., "gorgeous," "pretty," "mystical") with technical or functional descriptors.
2. Clinical Objectivity: Frame aesthetic choices as "precision-driven" or "sophisticated" rather than "trendy" or "fashionable".
3. The "Invisible" Directive: Ensure the function never uses personal bridge phrases like "since you like" or "perfect for you," maintaining a neutral, authoritative stance.
4. Standardized Terminology: Use the following mapping for common product attributes:


Original Term | Protocol Replacement
"Soft/Comfortable" | "Resilient environment for comfort"
"Beautiful/Pretty" | "Aesthetic consistency / Striking visual appeal"
"Easy to use" | "Streamlined maintenance process"
"Lasting/Long-wear" |"Durable foundation"

Implementation Logic for Your Function

When processing your scraped data from platforms like Target or Bloomingdale's, your function should follow this sequence:
1.Extract Primary Material/Active: Identify the core component (e.g., Squalane, Linen, Steel).
2.Identify Primary Benefit: Determine if the goal is hydration, organization, or wardrobe utility.
3.Assemble: Plug these variables into the "Hero Statement" and "Functional Anchor" templates.

DO NOT make claims about health outcomes, skin results, or performance guarantees unless those exact claims appear in the source text.
Limit to 3-4 sentences  `;

serve(async (req) => {
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
          temperature: 0.4,
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
