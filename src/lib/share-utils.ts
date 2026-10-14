import type { ProductWithTaxonomy } from "@/lib/supabase-queries";

const VIBE_COPY: Record<string, string> = {
  "Bloom & Glow": "Found something beautiful you might love 🌸",
  "Build Mode": "This tool is actually brilliant — worth a look 🔧",
  "Dress to Impress": "Obsessed with this find 👗 — thought of you",
  "Drip & Shine": "Okay this is stunning 💎 — you need to see this",
  "Quiet Luxury": "This is understated elegance at its finest ✨",
  "Soft Academia": "This has such cozy scholarly vibes 📚",
  "Get Sporty": "Level up your game with this one 🏃",
  "Sustainable Futurism": "Future-forward and eco-friendly 🌍",
  "Eclectic Maximalist": "Bold, fun, and full of personality 🎨",
  "Whimsigoth": "Dark, dreamy, and absolutely enchanting 🌙",
  "Urban Tech-Wear": "Sleek tech meets street style 🖤",
  "The Wellness Era": "Your wellness journey needs this 🧘",
  "Work-From-Anywhere": "Work smarter from wherever you are 💻",
  "Organized Life": "Get your life together with this gem 📋",
  "Little Ones": "The cutest find for little ones 🧸",
  "Geek & Gamer": "Every geek and gamer needs to see this 🎮",
};

const DEFAULT_COPY = "Check out this amazing find! 🛍️";

export function getShareCopy(product: ProductWithTaxonomy): string {
  for (const vibe of product.vibeNames ?? []) {
    if (VIBE_COPY[vibe]) return VIBE_COPY[vibe];
  }
  return DEFAULT_COPY;
}

export function getProductShareUrl(product: ProductWithTaxonomy, platform: string): string {
  const baseUrl = `${window.location.origin}/product/${(product as any).slug || product.id}`;
  const vibeSlug = product.vibeSlugs?.[0] ?? "general";

  const params = new URLSearchParams({
    utm_source: platform,
    utm_medium: "social",
    utm_campaign: "product_share",
    utm_content: vibeSlug,
  });

  return `${baseUrl}?${params.toString()}`;
}

export type SharePlatform = "pinterest" | "whatsapp" | "instagram" | "facebook" | "email" | "copy";

export function fireShareEvent(product: ProductWithTaxonomy, method: SharePlatform) {
  const vibeSlug = product.vibeSlugs?.[0] ?? "general";

  // Enzuzo auto-blocks gtag.js until consent is granted, so a simple existence check is enough.
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "share", {
      method,
      content_type: "product",
      item_id: product.id,
      item_category: vibeSlug,
    });
  }
}

export function buildShareLink(
  platform: SharePlatform,
  product: ProductWithTaxonomy
): string | null {
  const url = getProductShareUrl(product, platform);
  const text = getShareCopy(product);
  const fullText = `${text}\n${product.name}`;

  switch (platform) {
    case "pinterest":
      return `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(fullText)}${product.image_url ? `&media=${encodeURIComponent(product.image_url)}` : ""}`;
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(`${fullText}\n${url}`)}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(fullText)}`;
    case "email":
      return `mailto:?subject=${encodeURIComponent(`Check out: ${product.name}`)}&body=${encodeURIComponent(`${fullText}\n\n${url}`)}`;
    case "instagram":
      return `https://www.instagram.com/`;
    case "copy":
      return null; // handled separately
  }
}
