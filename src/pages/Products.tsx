import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { getProductsPaginated, getCategories, filterByRegion } from "@/lib/supabase-queries";
import ProductCard from "@/components/ProductCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";
import { useRegion } from "@/contexts/RegionContext";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

const toTitleCase = (s: string) =>
  s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const PAGE_SIZE = 30;

export default function Products() {
  const { region } = useRegion();
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
  const { data: moodCategories = [] } = useQuery({
    queryKey: ["categories", "mood"],
    queryFn: () => getCategories("mood"),
  });

  const [filterMood, setFilterMood] = useState("");
  const [filterVendor, setFilterVendor] = useState("");
  const [page, setPage] = useState(1);

  const { data: brandsList = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const categoryName = coreCategories.find((c) => c.slug === categorySlug)?.name || "";
  const vibeName = vibeCategories.find((c) => c.slug === vibeSlug)?.name || "";

  useSEO({
    title: categoryName || vibeName || "All Products",
    description: `Browse ${categoryName || vibeName || "all products"} on Mood & Vibes.`,
  });

  const [sort, setSort] = useState<"newest" | "price-low" | "price-high" | "updated-desc" | "updated-asc">("newest");

  const moodSlug = searchParams.get("mood") || "";
  const moodName = moodCategories.find((c) => c.slug === moodSlug)?.name || filterMood;

  const { data: result, isLoading } = useQuery({
    queryKey: ["products-paginated", categoryName, vibeName, moodName, sort, page, filterVendor],
    queryFn: () =>
      getProductsPaginated({
        category: categoryName || undefined,
        vibeCategory: vibeName || undefined,
        mood: moodName || undefined,
        vendorId: filterVendor || undefined,
        sort,
        activeOnly: true,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const products = result?.data ?? [];
  const totalCount = result?.count ?? 0;
  const regionProducts = filterByRegion(products, region);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const availableVendors = useMemo(() => {
    return brandsList
      .map((b: any) => ({ id: b.id, name: toTitleCase(b.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [brandsList]);

  // Reset page when filters change
  const resetPage = useCallback(() => setPage(1), []);

  const setCategory = (slug: string) => {
    if (slug === "all") {
      searchParams.delete("category");
    } else {
      searchParams.set("category", slug);
    }
    searchParams.delete("vibe");
    setSearchParams(searchParams);
    resetPage();
  };

  const setVibe = (slug: string) => {
    if (slug === "all") {
      searchParams.delete("vibe");
    } else {
      searchParams.set("vibe", slug);
    }
    searchParams.delete("category");
    setSearchParams(searchParams);
    resetPage();
  };

  return (
    <div className="container py-12">
      <h1 className="mb-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">
        {categoryName || vibeName || "All Products"}
      </h1>
      <p className="mb-8 text-muted-foreground">
        {categoryName || vibeName
          ? `Browsing ${categoryName || vibeName}`
          : `Browse everything we've found — ${totalCount.toLocaleString()} products`}
      </p>

      {/* Filters */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        <Select value={categorySlug || "all"} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {coreCategories.map((c) => (
              <SelectItem key={c.id} value={c.slug}>
                {c.icon} {c.name}
              </SelectItem>
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
              <SelectItem key={c.id} value={c.slug}>
                {c.icon} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={moodSlug || filterMood || "all"}
          onValueChange={(v) => {
            if (v === "all") {
              searchParams.delete("mood");
              setFilterMood("");
            } else {
              const cat = moodCategories.find((c) => c.slug === v);
              if (cat) {
                searchParams.set("mood", v);
                setFilterMood(cat.name);
              }
            }
            setSearchParams(searchParams);
            resetPage();
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Mood" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Moods</SelectItem>
            {moodCategories.map((c) => (
              <SelectItem key={c.id} value={c.slug}>
                {c.icon} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterVendor || "all"}
          onValueChange={(v) => {
            setFilterVendor(v === "all" ? "" : v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {availableVendors.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sort}
          onValueChange={(v) => {
            setSort(v as typeof sort);
            resetPage();
          }}
        >
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
        <div className="flex justify-center py-20" role="status" aria-label="Loading products">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : regionProducts.length === 0 ? (
        <p className="py-20 text-center text-muted-foreground">No products available in your region.</p>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {regionProducts.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <ProductCard product={p} />
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav
              className="mt-10 flex items-center justify-center gap-2"
              aria-label="Product pagination"
            >
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(1)}
                disabled={page === 1}
                aria-label="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span className="px-3 text-sm text-muted-foreground">
                Page <strong className="text-foreground">{page}</strong> of{" "}
                <strong className="text-foreground">{totalPages}</strong>
                <span className="ml-2 hidden sm:inline">
                  ({totalCount.toLocaleString()} products)
                </span>
              </span>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                aria-label="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
