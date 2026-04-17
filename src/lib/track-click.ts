import { supabase } from "@/lib/supabase";

export async function trackProductClick(productId: string) {
  await supabase.from("product_clicks").insert({ product_id: productId });
}
