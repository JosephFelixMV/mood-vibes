import { supabase } from "@/integrations/supabase/client";

export async function trackProductClick(productId: string) {
  await supabase.from("product_clicks").insert({ product_id: productId });
}
