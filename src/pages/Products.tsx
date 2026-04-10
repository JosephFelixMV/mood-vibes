import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import { getProducts, getCategories } from "@/lib/supabase-queries";
import ProductCard from "@/components/ProductCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSEO } from "@/hooks/useSEO";

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categorySlug = searchParams.get("category") || "";
  const vibeSlug = searchParams.get("vibe") || "";

  const { data: coreCategories = [] } = useQuery({
    queryKey: ["categories", "core"],
    queryFn: () => getCategories("core"),
  });
  const { data: vibeCategories = [] } = useQuery({
    queryKey: ["categories", "vibe"],
    queryFn: () => getCategories("vibe"),
  });

  const categoryName = coreCategories.find((c) => c.slug === categorySlug)?.name || "";
  const vibeName = vibeCategories.find((c) => c.slug === vibeSlug)?.name || "";

  useSEO({
    title: categoryName || vibeName || "All Products",
    description: `Browse ${categoryName || vibeName || "all products"} on Mood & Vibes.`,
  });

  const [sort, setSort] = useState<"newest" | "price-low" | "price-high" | "updated-desc" | "updated-asc">("newest");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", categoryName, vibeName, sort],
    queryFn: () => getProducts({
      category: categoryName || undefined,
      vibeCategory: vibeName || undefined,
      sort,
      activeOnly: true,
    }),
  });

  const setCategory = (slug: string) => {
    if (slug === "all") {
      searchParams.delete("category");
    } else {
      searchParams.set("category", slug);
    }
    searchParams.delete("vibe");
    setSearchParams(searchParams);
  };

  const setVibe = (slug: string) => {
    if (slug === "all") {
      searchParams.delete("vibe");
    } else {
      searchParams.set("vibe", slug);
    }
    searchParams.delete("category");
    setSearchParams(searchParams);
  };

  return (
    <div className="container py-12">
      <h1 className="mb-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">
        {categoryName || vibeName || "All Products"}
      </h1>
      <p className="mb-8 text-muted-foreground">
        {categoryName || vibeName ? `Browsing ${categoryName || vibeName}` : "Browse everything we've found"}
      </p>

      {/* Filters */}
      <div className="mb-8 flex flex-wrap gap-3">
        <Select value={categorySlug || "all"} onValueChange={setCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {coreCategories.map((c) => (
              <SelectItem key={c.id} value={c.slug}>{c.icon} {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={vibeSlug || "all"} onValueChange={setVibe}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Vibe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vibes</SelectItem>
            {vibeCategories.map((c) => (
              <SelectItem key={c.id} value={c.slug}>{c.icon} {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="price-low">Price: Low → High</SelectItem>
            <SelectItem value="price-high">Price: High → Low</SelectItem>
            <SelectItem value="updated-desc">Last Updated ↓</SelectItem>
            <SelectItem value="updated-asc">Last Updated ↑</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : products.length === 0 ? (
        <p className="py-20 text-center text-muted-foreground">No products found.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p, i) => (
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
