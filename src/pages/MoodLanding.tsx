import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { getCategories, getRandomProduct, filterByRegion, getRelatedArticlesForProducts } from "@/lib/supabase-queries";
import { parseTaxonomyString } from "@/lib/taxonomy-utils";
import DiscoveryTile from "@/components/DiscoveryTile";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";
import { useSEO } from "@/hooks/useSEO";
import { setDiscoveryContext } from "@/lib/discovery-context";

import { useRegion } from "@/contexts/RegionContext";
import type { Product } from "@/lib/supabase-queries";

const toTitleCase = (s: string) =>
  s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

export default function MoodLanding() {
  const { slug } = useParams<{ slug: string }>();
  const { region } = useRegion();
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<
    { type: "core" | "vibe"; slug: string } | null
  >(null);

  const { data: moods = [] } = useQuery({
    queryKey: ["categories", "mood"],
    queryFn: () => getCategories("mood"),
  });

  const { data: coreCats = [] } = useQuery({
    queryKey: ["categories", "core"],
    queryFn: () => getCategories("core"),
  });

  const { data: vibeCats = [] } = useQuery({
    queryKey: ["categories", "vibe"],
    queryFn: () => getCategories("vibe"),
  });

  const mood = moods.find((m) => m.slug === slug);

  useEffect(() => {
    if (slug && mood?.name) {
      setDiscoveryContext({ type: "mood", slug, name: mood.name });
    }
  }, [slug, mood?.name]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["mood-products", mood?.slug, sort],
    queryFn: async () => {
      if (!mood) return [];

      const { data: junctionRows, error: jErr } = await supabase
        .from("product_moods")
        .select("product_id")
        .eq("mood_slug", mood.slug);
      if (jErr) throw jErr;

      const productIds = [...new Set((junctionRows || []).map((r: any) => r.product_id))];
      if (!productIds.length) return [];

      let query = supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .in("id", productIds);

      query = sort === "newest"
        ? query.order("date_added", { ascending: false })
        : query.order("date_added", { ascending: true });

      query = query.limit(300);
      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!mood,
  });

  const [filterVendor, setFilterVendor] = useState("");

  const { data: brandsList = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  const { data: relatedArticlesMap = {} } = useQuery({
    queryKey: ["related-articles", products.map((p) => p.id)],
    queryFn: () => getRelatedArticlesForProducts(products.map((p) => p.id)),
    enabled: products.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  const regionProducts = filterByRegion(products, region);

  const vendorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    regionProducts.forEach((p) => {
      if (p.vendor_id) counts[p.vendor_id] = (counts[p.vendor_id] || 0) + 1;
    });
    return counts;
  }, [regionProducts]);

  const availableVendors = useMemo(() => {
    const vendorIds = new Set(regionProducts.map((p) => p.vendor_id).filter(Boolean));
    return brandsList
      .filter((b: any) => vendorIds.has(b.id))
      .map((b: any) => ({ id: b.id, name: toTitleCase(b.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [regionProducts, brandsList]);

  const categoryCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    regionProducts.forEach((p) => {
      parseTaxonomyString(p.category).forEach((name) => {
        counts[name.toLowerCase()] = (counts[name.toLowerCase()] || 0) + 1;
      });
    });
    return counts;
  }, [regionProducts]);

  const vibeCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    regionProducts.forEach((p) => {
      parseTaxonomyString(p.vibe_category).forEach((name) => {
        counts[name.toLowerCase()] = (counts[name.toLowerCase()] || 0) + 1;
      });
    });
    return counts;
  }, [regionProducts]);

  const availableCoreCats = isLoading
    ? coreCats
    : coreCats.filter((c) => (categoryCountMap[c.name.toLowerCase()] || 0) >= 3);

  const availableVibeCats = isLoading
    ? vibeCats
    : vibeCats.filter((v) => (vibeCountMap[v.name.toLowerCase()] || 0) >= 3);

  const filteredProducts = regionProducts.filter((p) => {
    if (filterVendor && p.vendor_id !== filterVendor) return false;
    return true;
  });

  // Use null guard to avoid "0 products" flash before query resolves
  const stableProductCount = products.length > 0 ? products.length : null;

  useSEO({
    title: mood ? `${mood.name} Mood | Curated Products | Mood & Vibes` : undefined,
    rawTitle: true,
    description: mood
      ? (mood.description || (stableProductCount
          ? `${stableProductCount} products curated for a ${mood.name} mood. Find your mood. Shop the vibe on Mood & Vibes.`
          : `Curated products for a ${mood.name} mood. Find your mood. Shop the vibe on Mood & Vibes.`))
      : undefined,
    keywords: mood
      ? [mood.name, `${mood.name} mood`, `${mood.name} products`, `${mood.name} gifts`, "mood shopping", "mood and vibes"]
      : undefined,
    url: `${window.location.origin}/mood/${slug}`,
    ogType: "website",
    collectionName: mood ? `${mood.name} Mood Products | Mood & Vibes` : undefined,
    breadcrumbs: mood ? [
      { name: "Home", url: "https://www.mood-and-vibes.com/" },
      { name: "Moods", url: "https://www.mood-and-vibes.com/moods" },
      { name: `${mood.name} Mood`, url: `https://www.mood-and-vibes.com/mood/${slug}` },
    ] : undefined,
  });

  if (!mood) {
    return <div className="container py-20 text-center text-muted-foreground">Mood not found.</div>;
  }

  return (
    <div className="container py-12">
      <div className="mb-8 flex items-start gap-4">
        <CategoryIcon category={mood} emojiClassName="text-4xl" imgClassName="h-12 w-12 rounded object-cover" />
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">{mood.name}</h1>
          {mood.description && <p className="mt-2 text-muted-foreground">{mood.description}</p>}
        </div>
      </div>

      {/* Discovery tile */}
      {filteredProducts.length > 0 && (
        <DiscoveryTile products={filteredProducts} getRandomProduct={getRandomProduct} ctaLabel="Lock in Mood" />
      )}

      {/* Sort + Vendor filter */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="min-w-0 font-heading text-xl font-semibold leading-snug sm:flex-1">All {mood.name} Products ({filteredProducts.length})</h2>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
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
          {availableCoreCats.length > 0 && (
            <Select
              value={activeFilter?.type === "core" ? activeFilter.slug : undefined}
              onValueChange={(coreSlug) => {
                if (!coreSlug || !slug) return;
                setActiveFilter({ type: "core", slug: coreSlug });
                navigate(`/category/${coreSlug}/mood/${slug}`);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Shop by Category" />
              </SelectTrigger>
              <SelectContent>
                {availableCoreCats.map((c) => (
                  <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {availableVibeCats.length > 0 && (
            <Select
              value={activeFilter?.type === "vibe" ? activeFilter.slug : undefined}
              onValueChange={(vibeSlug) => {
                if (!vibeSlug || !slug) return;
                setActiveFilter({ type: "vibe", slug: vibeSlug });
                navigate(`/vibe/${vibeSlug}/mood/${slug}`);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Shop by Vibe" />
              </SelectTrigger>
              <SelectContent>
                {availableVibeCats.map((v) => (
                  <SelectItem key={v.id} value={v.slug}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Button
              variant={sort === "newest" ? "default" : "outline"}
              size="sm"
              onClick={() => setSort("newest")}
              className="w-full rounded-full sm:w-auto"
            >
              Newest
            </Button>
            <Button
              variant={sort === "oldest" ? "default" : "outline"}
              size="sm"
              onClick={() => setSort("oldest")}
              className="w-full rounded-full sm:w-auto"
            >
              Oldest
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <p className="py-20 text-center text-muted-foreground">No products match the current filters.</p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <ProductCard product={p} ctaLabel="Lock in Mood" relatedArticle={relatedArticlesMap[p.id] ?? null} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
