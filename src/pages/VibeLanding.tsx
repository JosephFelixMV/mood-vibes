import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { getCategories, getRandomProduct, filterByRegion, type Product } from "@/lib/supabase-queries";
import DiscoveryTile from "@/components/DiscoveryTile";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSEO } from "@/hooks/useSEO";
import { setDiscoveryContext } from "@/lib/discovery-context";

import { useRegion } from "@/contexts/RegionContext";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";

const toTitleCase = (s: string) =>
  s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

export default function VibeLanding() {
  const { region } = useRegion();
  const { slug } = useParams<{ slug: string }>();

  const { data: vibes = [] } = useQuery({
    queryKey: ["categories", "vibe"],
    queryFn: () => getCategories("vibe"),
  });

  const vibe = vibes.find((v) => v.slug === slug);
  const vibeName = vibe?.name || "";

  useEffect(() => {
    if (slug && vibeName) {
      setDiscoveryContext({ type: "vibe", slug, name: vibeName });
    }
  }, [slug, vibeName]);

  useSEO({
    title: vibe ? `${vibeName} Aesthetic | Curated Finds | Mood & Vibes` : undefined,
    rawTitle: true,
    description: vibe
      ? (vibe.description || `Browse ${vibeName} aesthetic products curated by mood and style. Find your vibe on Mood & Vibes.`)
      : undefined,
    keywords: vibe
      ? [vibeName, `${vibeName} aesthetic`, `${vibeName} products`, `${vibeName} style`, "mood and vibes", "aesthetic finds"]
      : undefined,
    url: `${window.location.origin}/vibe/${slug}`,
    ogType: "website",
    collectionName: vibe ? `${vibeName} Aesthetic Products | Mood & Vibes` : undefined,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["vibe-products", slug, vibeName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .ilike("vibe_category", `%${vibeName}%`)
        .order("date_added", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data as Product[]).filter((p) => !p.page_error);
    },
    enabled: !!vibeName,
  });

  const [filterVendor, setFilterVendor] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const { data: brandsList = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const regionFiltered = filterByRegion(products.filter((p) => !p.page_error), region);

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
    return true;
  });

  const sortedProducts = [...healthyProducts].sort((a, b) => {
    const dateA = new Date(a.date_added).getTime();
    const dateB = new Date(b.date_added).getTime();
    return sort === "newest" ? dateB - dateA : dateA - dateB;
  });

  if (!vibe && !isLoading) {
    return (
      <div className="container py-20 text-center">
        <h1 className="font-heading text-3xl font-bold">Vibe not found</h1>
        <p className="mt-2 text-muted-foreground">The vibe you're looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className="container py-12">
      <div className="mb-4">
        <h1 className="mb-2 flex items-center gap-3 font-heading text-3xl font-bold tracking-tight md:text-4xl">
          {vibe?.icon && <CategoryIcon category={vibe} emojiClassName="text-4xl" imgClassName="h-10 w-10 rounded object-cover" />}
          {vibeName}
        </h1>
        {vibe?.description && (
          <p className="mb-2 text-muted-foreground">{vibe.description}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {healthyProducts.length} product{healthyProducts.length !== 1 ? "s" : ""} in this vibe
        </p>
      </div>

      {!isLoading && healthyProducts.length > 0 && (
        <DiscoveryTile products={healthyProducts} getRandomProduct={getRandomProduct} ctaLabel="Vibe with It" />
      )}

      {!isLoading && products.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="min-w-0 font-heading text-lg font-semibold leading-snug sm:flex-1">All {vibeName} Products</h2>
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
        <p className="py-20 text-center text-muted-foreground">No products found in this vibe.</p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {sortedProducts.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <ProductCard product={p} ctaLabel="Vibe with It" />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
