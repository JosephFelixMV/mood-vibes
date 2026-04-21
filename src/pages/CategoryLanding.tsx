import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { getCategories, getRandomProduct, filterByRegion, type Product } from "@/lib/supabase-queries";
import { setDiscoveryContext } from "@/lib/discovery-context";
import DiscoveryTile from "@/components/DiscoveryTile";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSEO } from "@/hooks/useSEO";

import { useRegion } from "@/contexts/RegionContext";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";

const toTitleCase = (s: string) =>
  s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const FASHION_SLUGS = ["fashion-style", "womens-fashion", "mens-fashion", "womens-shoes", "mens-shoes", "activewear"];

const SEASON_OPTIONS = [
  { value: "spring_summer", label: "Spring / Summer" },
  { value: "fall_winter", label: "Fall / Winter" },
  { value: "all_season", label: "All Season" },
];

const WARMTH_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "mid_layer", label: "Mid-layer" },
  { value: "warm", label: "Warm" },
  { value: "heavy_duty", label: "Heavy Duty" },
];

export default function CategoryLanding() {
  const { region } = useRegion();
  const { slug } = useParams<{ slug: string }>();

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", "core"],
    queryFn: () => getCategories("core"),
  });

  // Find the category by slug — could be parent or sub
  const category = categories.find((c) => c.slug === slug);
  const categoryName = category?.name || "";
  const isParent = category && !category.parent_slug;

  // If parent, also gather child names for filtering
  const childNames = isParent
    ? categories.filter((c) => c.parent_slug === slug).map((c) => c.name)
    : [];

  const filterNames = isParent && childNames.length > 0
    ? [categoryName, ...childNames]
    : [categoryName];

  const isFashionCategory = FASHION_SLUGS.includes(slug || "");

  useEffect(() => {
    if (slug && categoryName) {
      setDiscoveryContext({ type: "category", slug, name: categoryName });
    }
  }, [slug, categoryName]);

  useSEO({
    title: categoryName ? `${categoryName} | Curated Picks | Mood & Vibes` : "Category | Mood & Vibes",
    rawTitle: true,
    description: category?.description
      ? category.description
      : `Discover curated ${categoryName} products. Find your mood. Shop the vibe on Mood & Vibes.`,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["category-products", slug, filterNames.join(",")],
    queryFn: async () => {
      const orClause = filterNames
        .map((n) => `category.ilike.*${n.replace(/[,()"]/g, "")}*`)
        .join(",");
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .or(orClause)
        .order("date_added", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data as Product[]).filter((p) => !p.page_error);
    },
    enabled: !!categoryName,
  });

  const [filterVendor, setFilterVendor] = useState("");
  const [filterSeason, setFilterSeason] = useState("");
  const [filterWarmth, setFilterWarmth] = useState("");

  const { data: brandsList = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const regionFiltered = filterByRegion(products.filter((p) => !p.page_error), region);

  // Only show vendors that have products in this category
  const vendorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    regionFiltered.forEach((p) => {
      if (p.vendor_id) counts[p.vendor_id] = (counts[p.vendor_id] || 0) + 1;
    });
    return counts;
  }, [regionFiltered]);

  const availableVendors = useMemo(() => {
    const vendorIds = new Set(regionFiltered.map((p) => p.vendor_id).filter(Boolean));
    return brandsList
      .filter((b: any) => vendorIds.has(b.id))
      .map((b: any) => ({ id: b.id, name: toTitleCase(b.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [regionFiltered, brandsList]);

  const healthyProducts = regionFiltered.filter((p) => {
    if (filterVendor && p.vendor_id !== filterVendor) return false;
    if (filterSeason && p.fashion_season !== filterSeason) return false;
    if (filterWarmth && p.fashion_warmth !== filterWarmth) return false;
    return true;
  });
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const sortedProducts = [...healthyProducts].sort((a, b) => {
    const dateA = new Date(a.date_added).getTime();
    const dateB = new Date(b.date_added).getTime();
    return sort === "newest" ? dateB - dateA : dateA - dateB;
  });


  if (!category && !isLoading) {
    return (
      <div className="container py-20 text-center">
        <h1 className="font-heading text-3xl font-bold">Category not found</h1>
        <p className="mt-2 text-muted-foreground">The category you're looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className="container py-12">
      {/* Header */}
      <div className="mb-4">
        <h1 className="mb-2 flex items-center gap-3 font-heading text-3xl font-bold tracking-tight md:text-4xl">
          {category?.icon && <CategoryIcon category={category} emojiClassName="text-4xl" imgClassName="h-10 w-10 rounded object-cover" />}
          {categoryName}
        </h1>
        {category?.description && (
          <p className="mb-2 text-muted-foreground">{category.description}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {healthyProducts.length} product{healthyProducts.length !== 1 ? "s" : ""}{" "}
          {healthyProducts.length !== products.length ? `of ${products.length} total` : "in this category"}
        </p>
      </div>

      {/* Fashion style filters */}
      {isFashionCategory && !isLoading && products.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Season</p>
            <div className="flex flex-wrap gap-1.5">
              {SEASON_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilterSeason(filterSeason === value ? "" : value)}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    filterSeason === value
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border bg-card text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="ml-4">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Warmth</p>
            <div className="flex flex-wrap gap-1.5">
              {WARMTH_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilterWarmth(filterWarmth === value ? "" : value)}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    filterWarmth === value
                      ? "border-accent bg-accent/10 text-accent-foreground font-medium"
                      : "border-border bg-card text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {(filterSeason || filterWarmth) && (
            <div className="ml-auto flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setFilterSeason(""); setFilterWarmth(""); }}
                className="text-xs"
              >
                Clear style filters
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Discovery tile */}
      {!isLoading && healthyProducts.length > 0 && (
        <DiscoveryTile products={healthyProducts} getRandomProduct={getRandomProduct} ctaLabel="Discover Brand" />
      )}

      {/* Sort + Product grid */}
      {!isLoading && products.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="min-w-0 font-heading text-lg font-semibold leading-snug sm:flex-1">All {categoryName} Products</h2>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-end">
            <Select value={filterVendor || "all"} onValueChange={(v) => setFilterVendor(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Vendor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {availableVendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name} ({vendorCounts[v.id] || 0})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : products.length === 0 ? (
        <p className="py-20 text-center text-muted-foreground">No products found in this category.</p>
      ) : healthyProducts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-muted-foreground">No products match the current filters.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => { setFilterSeason(""); setFilterWarmth(""); setFilterVendor(""); }}
          >
            Clear all filters
          </Button>
        </div>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {sortedProducts.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <ProductCard product={p} ctaLabel="Discover Brand" />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}