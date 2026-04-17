import { supabase } from "@/lib/supabase";

const SESSION_KEY = "tracked_views";

function getSessionViews(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markViewed(productId: string) {
  try {
    const views = getSessionViews();
    views.add(productId);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...views]));
  } catch {
    // storage full or unavailable
  }
}

function isLikelyBot(): boolean {
  if (typeof navigator === "undefined") return true;
  const ua = navigator.userAgent;
  return /bot|crawl|spider|slurp|wget|curl|fetch|headless|phantom|prerender/i.test(ua);
}

export async function trackEvent(productId: string, eventType: "view" | "click") {
  if (isLikelyBot()) return;

  if (eventType === "view") {
    if (getSessionViews().has(productId)) return;
    markViewed(productId);
  }
  try {
    await supabase.from("product_events").insert({
      product_id: productId,
      event_type: eventType,
    });
  } catch {
    // silently fail — never disrupt shopping experience
  }
}
