import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shuffle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getProducts, getCategories, getRandomProduct, filterByRegion } from "@/lib/supabase-queries";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSEO } from "@/hooks/useSEO";
import { useRateLimitedAction } from "@/hooks/useRateLimitedAction";
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

  useSEO({
    title: categoryName || "Category",
    description: category?.description || `Browse ${categoryName} products on Surprise Shopper.`,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["category-products", slug, filterNames.join(",")],
    queryFn: async () => {
      const all = await getProducts({ sort: "newest", activeOnly: true });
      return all.filter((p) =>
        filterNames.some((name) =>
          p.category.split(",").map((c) => c.trim()).includes(name)
        )
      );
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
  const [randomPick, setRandomPick] = useState<typeof products[0] | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const { trigger, cooldown } = useRateLimitedAction(2000);

  const sortedProducts = [...healthyProducts].sort((a, b) => {
    const dateA = new Date(a.date_added).getTime();
    const dateB = new Date(b.date_added).getTime();
    return sort === "newest" ? dateB - dateA : dateA - dateB;
  });

  // Auto-pick a random product on first load
  useEffect(() => {
    if (healthyProducts.length > 0 && !randomPick) {
      setRandomPick(getRandomProduct(healthyProducts));
    }
  }, [healthyProducts]);

  const handleRandomPick = () => {
    trigger(() => {
      const next = getRandomProduct(healthyProducts, randomPick?.id);
      setRandomPick(next);
      setAnimKey((k) => k + 1);
    });
  };

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

      {/* Random pick section */}
      {!isLoading && products.length > 0 && (
        <section className="mb-12">
          <div className="mb-4 flex items-center gap-4">
            <h2 className="font-heading text-xl font-semibold">
              <Sparkles className="mr-2 inline h-5 w-5 text-primary" />
              Discover Something Random
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRandomPick}
              disabled={cooldown || healthyProducts.length === 0}
              className="gap-2 rounded-full"
            >
              <Shuffle className="h-4 w-4" />
              {cooldown ? "Wait…" : randomPick ? "Try Another" : "Pick One"}
            </Button>
          </div>

          <AnimatePresence mode="wait">
            {randomPick && (
              <motion.div
                key={animKey}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="mx-auto max-w-3xl"
              >
                <ProductCard product={randomPick} featured />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Sort + Product grid */}
      {!isLoading && products.length > 0 && (
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">All {categoryName} Products</h2>
          <div className="flex gap-3">
            <Select value={filterBrand || "all"} onValueChange={(v) => setFilterBrand(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {availableBrands.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="w-[180px]">
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
            onClick={() => { setFilterSeason(""); setFilterWarmth(""); setFilterBrand(""); }}
          >
            Clear all filters
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sortedProducts.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <ProductCard product={p} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}