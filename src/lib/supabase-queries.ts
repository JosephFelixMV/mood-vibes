import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { VisitorRegion } from "@/hooks/useVisitorRegion";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];

/** Helper: filter products client-side by region availability */
export function filterByRegion(products: Product[], region?: VisitorRegion): Product[] {
  if (!region) return products;
  return products.filter((p) => {
    const regions = (p as any).regions as string[] | null;
    if (!regions || regions.length === 0) return true; // no regions = show everywhere
    return regions.includes(region) || regions.includes("Intl");
  });
}

export async function getProducts(options?: {
  category?: string;
  vibeCategory?: string;
  sort?: "newest" | "price-low" | "price-high" | "updated-desc" | "updated-asc";
  activeOnly?: boolean;
}) {
  let query = supabase.from("products").select("*");

  if (options?.activeOnly !== false) {
    query = query.eq("is_active", true);
  }
  if (options?.category) {
    query = query.ilike("category", `%${options.category}%`);
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
    case "updated-desc":
      query = query.order("updated_at", { ascending: false });
      break;
    case "updated-asc":
      query = query.order("updated_at", { ascending: true });
      break;
    case "newest":
    default:
      query = query.order("date_added", { ascending: false });
  }

  // Paginate to bypass the 1000-row default limit
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: page, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    allData = allData.concat(page || []);
    hasMore = (page?.length || 0) === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return allData;
}

export async function getProduct(idOrSlug: string) {
  // Try slug first, fall back to id (UUID) for backwards compat
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  const column = isUuid ? "id" : "slug";
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq(column, idOrSlug)
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

export async function getCategories(type?: "core" | "vibe" | "mood") {
  let query = supabase.from("categories").select("*").order("name");
  if (type) {
    query = query.eq("type", type);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getProductCountByCategory() {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from("products")
      .select("category")
      .eq("is_active", true)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    allData = allData.concat(data || []);
    hasMore = (data?.length || 0) === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  const counts: Record<string, number> = {};
  allData.forEach((p) => {
    p.category.split(",").forEach((c: string) => {
      const trimmed = c.trim();
      if (trimmed) counts[trimmed] = (counts[trimmed] || 0) + 1;
    });
  });
  return counts;
}

export async function getProductCountByVibe() {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from("products")
      .select("vibe_category")
      .eq("is_active", true)
      .not("vibe_category", "is", null)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    allData = allData.concat(data || []);
    hasMore = (data?.length || 0) === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  const counts: Record<string, number> = {};
  allData.forEach((p) => {
    if (p.vibe_category) {
      p.vibe_category.split(",").forEach((v: string) => {
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
/**
 * Server-side Product of the Day — same product for all visitors.
 * Calls a DB function that creates/returns today's pick.
 */
export async function getDailyPick(): Promise<Product | null> {
  const { data: productId, error } = await supabase.rpc("get_or_create_daily_pick");
  if (error || !productId) return null;

  const { data: product, error: pErr } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .single();
  if (pErr) return null;
  return product;
}

export function formatPrice(price: number | string): string {
  const num = typeof price === "string" ? parseFloat(price.replace(/[^0-9.]/g, "")) : price;
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
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

export async function getProductClickCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("product_clicks")
    .select("product_id");
  if (error) throw error;
  const counts: Record<string, number> = {};
  (data || []).forEach((row) => {
    counts[row.product_id] = (counts[row.product_id] || 0) + 1;
  });
  return counts;
}

export async function getProductViewCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("product_events")
    .select("product_id")
    .eq("event_type", "view");
  if (error) throw error;
  const counts: Record<string, number> = {};
  (data || []).forEach((row: any) => {
    counts[row.product_id] = (counts[row.product_id] || 0) + 1;
  });
  return counts;
}
