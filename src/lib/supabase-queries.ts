import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];

export async function getProducts(options?: {
  category?: string;
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

export async function getCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");
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

export function getProductOfTheDay(products: Product[]): Product | null {
  if (!products.length) return null;
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  return products[seed % products.length];
}

export function getRandomProduct(products: Product[], excludeId?: string): Product | null {
  const filtered = excludeId ? products.filter((p) => p.id !== excludeId) : products;
  if (!filtered.length) return null;
  return filtered[Math.floor(Math.random() * filtered.length)];
}
