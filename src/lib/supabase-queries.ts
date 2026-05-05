import { supabase } from "@/lib/supabase";
import type { Database } from "@/integrations/supabase/types";
import type { VisitorRegion } from "@/hooks/useVisitorRegion";

/**
 * Minimum number of active products a category/vibe/mood must have
 * to be shown to public visitors. Admin pages bypass this filter.
 * Adjust as the catalog grows.
 */
export const MIN_PRODUCTS_PER_CATEGORY = 8;

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];

export interface PublicCategory extends Category {
  product_count: number;
}

/** Helper: filter products client-side by region availability */
export function filterByRegion(products: Product[], region?: VisitorRegion): Product[] {
  if (!region) return products;
  return products.filter((p) => {
    const regions = (p as any).regions as string[] | null;
    if (!regions || regions.length === 0) return true;
    return regions.includes(region) || regions.includes("Intl");
  });
}

export interface PaginatedResult<T> {
  data: T[];
  count: number;
}

type SortOption = "newest" | "price-low" | "price-high" | "updated-desc" | "updated-asc";

export interface ProductQueryOptions {
  category?: string;
  vibeCategory?: string;
  mood?: string;
  sort?: SortOption;
  activeOnly?: boolean;
  brand?: string;
  vendorId?: string;
}

async function getProductIdsForTaxonomy(options?: ProductQueryOptions): Promise<string[] | null> {
  const queries: Promise<string[]>[] = [];

  if (options?.category) {
    queries.push(
      supabase.from("product_categories").select("product_id").eq("category_slug", options.category)
        .then(({ data }) => (data || []).map((r: any) => r.product_id))
    );
  }
  if (options?.vibeCategory) {
    queries.push(
      supabase.from("product_vibes").select("product_id").eq("vibe_slug", options.vibeCategory)
        .then(({ data }) => (data || []).map((r: any) => r.product_id))
    );
  }
  if (options?.mood) {
    queries.push(
      supabase.from("product_moods").select("product_id").eq("mood_slug", options.mood)
        .then(({ data }) => (data || []).map((r: any) => r.product_id))
    );
  }

  if (!queries.length) return null;

  const idArrays = await Promise.all(queries);
  if (idArrays.length === 1) return idArrays[0];

  // Multiple taxonomy filters → intersect
  const sets = idArrays.map((ids) => new Set(ids));
  return [...sets[0]].filter((id) => sets.every((s) => s.has(id)));
}

function applyProductFilters(
  options?: ProductQueryOptions,
  withCount = false,
) {
  let query = withCount
    ? supabase.from("products").select("*", { count: "exact" })
    : supabase.from("products").select("*");

  if (options?.activeOnly !== false) {
    query = query.eq("is_active", true);
  }
  // category / vibeCategory / mood are applied via junction table pre-query (see getProductIdsForTaxonomy)
  if (options?.vendorId) {
    query = query.eq("vendor_id", options.vendorId);
  }
  if (options?.brand) {
    query = query.ilike("company_name", options.brand);
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
  return query;
}

/** Server-side paginated product fetch — returns one page + total count */
export async function getProductsPaginated(
  options?: ProductQueryOptions & { page?: number; pageSize?: number },
): Promise<PaginatedResult<Product>> {
  const pageSize = options?.pageSize ?? 30;
  const page = options?.page ?? 1;
  const from = (page - 1) * pageSize;

  const taxonomyIds = await getProductIdsForTaxonomy(options);
  if (taxonomyIds !== null && taxonomyIds.length === 0) return { data: [], count: 0 };

  let query = applyProductFilters(options, true);
  if (taxonomyIds !== null) query = query.in("id", taxonomyIds);

  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;
  return { data: data || [], count: count ?? 0 };
}

/** Fetch ALL products (paginating internally past the 1000-row cap). Returns Product[]. */
export async function getProducts(options?: ProductQueryOptions): Promise<Product[]> {
  const PAGE_SIZE = 1000;

  const taxonomyIds = await getProductIdsForTaxonomy(options);
  if (taxonomyIds !== null && taxonomyIds.length === 0) return [];

  let allData: Product[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    let query = applyProductFilters(options);
    if (taxonomyIds !== null) query = query.in("id", taxonomyIds);
    const { data: page, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    allData = allData.concat((page || []) as Product[]);
    hasMore = (page?.length || 0) === PAGE_SIZE;
    from += PAGE_SIZE;
  }
  return allData;
}

/** Fetch all distinct brand names for filter dropdowns */
export async function getActiveBrands(): Promise<string[]> {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from("products")
      .select("company_name")
      .eq("is_active", true)
      .not("company_name", "is", null)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    allData = allData.concat(data || []);
    hasMore = (data?.length || 0) === PAGE_SIZE;
    from += PAGE_SIZE;
  }
  return Array.from(new Set(allData.map((p) => p.company_name).filter(Boolean) as string[])).sort();
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

/**
 * Public-facing category fetch — returns only categories with at least
 * MIN_PRODUCTS_PER_CATEGORY active products. Backed by the
 * `get_categories_with_counts` Postgres function which performs the
 * count + filter in a single round-trip.
 *
 * Use this in visitor-facing list/dropdown UIs.
 * Use `getCategories()` for admin UIs and slug lookups where every
 * category must remain accessible.
 */
export async function getPublicCategories(
  type?: "core" | "vibe" | "mood",
): Promise<PublicCategory[]> {
  const { data, error } = await supabase.rpc("get_categories_with_counts", {
    category_type: type ?? null,
  });
  if (error) throw error;
  return (data ?? []) as PublicCategory[];
}

export async function getProductCountByCategory(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("get_categories_with_counts", {
    category_type: "core",
  });
  if (error) throw error;
  const counts: Record<string, number> = {};
  (data || []).forEach((c: any) => { counts[c.slug] = c.product_count; });
  return counts;
}

export async function getProductCountByVibe(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("get_categories_with_counts", {
    category_type: "vibe",
  });
  if (error) throw error;
  const counts: Record<string, number> = {};
  (data || []).forEach((c: any) => { counts[c.slug] = c.product_count; });
  return counts;
}

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

export async function getProductClickCounts(sinceDays: number | null = 30): Promise<Record<string, number>> {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;
  const sinceIso = sinceDays != null
    ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  while (hasMore) {
    let q = supabase
      .from("product_clicks")
      .select("product_id")
      .range(from, from + PAGE_SIZE - 1);
    if (sinceIso) q = q.gte("clicked_at", sinceIso);
    const { data, error } = await q;
    if (error) throw error;
    allData = allData.concat(data || []);
    hasMore = (data?.length || 0) === PAGE_SIZE;
    from += PAGE_SIZE;
  }
  const counts: Record<string, number> = {};
  allData.forEach((row) => {
    counts[row.product_id] = (counts[row.product_id] || 0) + 1;
  });
  return counts;
}

export async function getProductViewCounts(sinceDays: number | null = 30): Promise<Record<string, number>> {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;
  const sinceIso = sinceDays != null
    ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  while (hasMore) {
    let q = supabase
      .from("product_events")
      .select("product_id")
      .eq("event_type", "view")
      .range(from, from + PAGE_SIZE - 1);
    if (sinceIso) q = q.gte("created_at", sinceIso);
    const { data, error } = await q;
    if (error) throw error;
    allData = allData.concat(data || []);
    hasMore = (data?.length || 0) === PAGE_SIZE;
    from += PAGE_SIZE;
  }
  const counts: Record<string, number> = {};
  allData.forEach((row: any) => {
    counts[row.product_id] = (counts[row.product_id] || 0) + 1;
  });
  return counts;
}
