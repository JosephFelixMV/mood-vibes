import { supabase } from "@/integrations/supabase/client";

const viewedProducts = new Set<string>();

export async function trackEvent(productId: string, eventType: "view" | "click") {
  if (eventType === "view") {
    if (viewedProducts.has(productId)) return;
    viewedProducts.add(productId);
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
