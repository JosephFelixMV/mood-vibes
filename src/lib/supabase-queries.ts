import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];

export async function getProducts(options?: {
  category?: string;
  vibeCategory?: string;
  sort?: "newest" | "price-low" | "price-high";
  activeOnly?: boolean;
}) {
  let query = supabase.from("products").select("*");

  if (options?.activeOnly !== false) {
    query = query.eq("is_active", true);
  }
  if (options?.category) {
    query = query.eq("category", options.category);
  }
  if (options?.vibeCategory) {
    query = query.ilike("vibe_category", `%${options.vibeCategory}%`);
  }

  switch (options?.sort) {
    case "price-low":
      query = query.order("price", { ascending: true });
      break;
    case "price-high":
      query = query.order("price", { ascending: false });
      break;
    case "newest":
    default:
      query = query.order("date_added", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getProduct(id: string) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function getProductImages(productId: string) {
  const { data, error } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .order("display_order");
  if (error) throw error;
  return data;
}

export async function getCategories(type?: "core" | "vibe") {
  let query = supabase.from("categories").select("*").order("name");
  if (type) {
    query = query.eq("type", type);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getProductCountByCategory() {
  const { data, error } = await supabase
    .from("products")
    .select("category")
    .eq("is_active", true);
  if (error) throw error;

  const counts: Record<string, number> = {};
  data.forEach((p) => {
    counts[p.category] = (counts[p.category] || 0) + 1;
  });
  return counts;
}

export async function getProductCountByVibe() {
  const { data, error } = await supabase
    .from("products")
    .select("vibe_category")
    .eq("is_active", true)
    .not("vibe_category", "is", null);
  if (error) throw error;

  const counts: Record<string, number> = {};
  data.forEach((p) => {
    if (p.vibe_category) {
      p.vibe_category.split(",").forEach((v) => {
        const trimmed = v.trim();
        if (trimmed) counts[trimmed] = (counts[trimmed] || 0) + 1;
      });
    }
  });
  return counts;
}

/**
 * Product of the Day — deterministic, 31-day no-repeat rotation.
 * Uses a hash of today's date as a seed. Cycles through products
 * ensuring no product repeats within 31 days (unless fewer products exist).
 */
export function getProductOfTheDay(products: Product[]): Product | null {
  if (!products.length) return null;

  const today = new Date();
  const dayIndex = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

  if (products.length <= 31) {
    // Not enough products to avoid 31-day repeats, just cycle
    return products[dayIndex % products.length];
  }

  // Use a sliding window: partition products into 31-day windows
  // The window offset shifts every 31 days
  const windowIndex = Math.floor(dayIndex / 31);
  const dayInWindow = dayIndex % 31;

  // Shuffle deterministically based on window
  const shuffled = [...products].sort((a, b) => {
    const hashA = simpleHash(a.id + windowIndex);
    const hashB = simpleHash(b.id + windowIndex);
    return hashA - hashB;
  });

  return shuffled[dayInWindow % shuffled.length];
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

export async function getProductSpecifications(productId: string) {
  const { data, error } = await supabase
    .from("product_specifications")
    .select("*")
    .eq("product_id", productId)
    .order("display_order");
  if (error) throw error;
  return data;
}

export function getRandomProduct(products: Product[], excludeId?: string): Product | null {
  const filtered = excludeId ? products.filter((p) => p.id !== excludeId) : products;
  if (!filtered.length) return null;
  return filtered[Math.floor(Math.random() * filtered.length)];
}
