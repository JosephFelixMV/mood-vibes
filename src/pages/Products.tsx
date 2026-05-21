import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useMemo, useState, useCallback, useEffect } from "react";
import { setDiscoveryContext } from "@/lib/discovery-context";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { getProductsPaginated, getCategories, filterByRegion } from "@/lib/supabase-queries";
import ProductCard from "@/components/ProductCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";
import { useRegion } from "@/contexts/RegionContext";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

const toTitleCase = (s: string) => s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const PAGE_SIZE = 30;
const SITE_URL = "https://www.mood-and-vibes.com";

export default function Products() {
  const { region } = useRegion();

  useEffect(() => {
    setDiscoveryContext({ type: "all", slug: "", name: "" });
  }, []);

  const [searchParams] = useSearchParams();
  const categorySlug = searchParams.get("category") || "";
  const vibeSlug = searchParams.get("vibe") || "";

  // Unfiltered lookup: used to resolve slugs from URL params even if a
  // category falls below the public threshold (preserves direct/shared links).
  const { data: allCoreCategories = [] } = useQuery({
    queryKey: ["categories", "core"],
    queryFn: () => getCategories("core"),
    staleTime: 1000 * 60 * 30,
  });
  const { data: allVibeCategories = [] } = useQuery({
    queryKey: ["categories", "vibe"],
    queryFn: () => getCategories("vibe"),
    staleTime: 1000 * 60 * 30,
  });
  const { data: allMoodCategories = [] } = useQuery({
    queryKey: ["categories", "mood"],
    queryFn: () => getCategories("mood"),
    staleTime: 1000 * 60 * 30,
  });

  const [filterVendor, setFilterVendor] = useState("");
  const [page, setPage] = useState(1);

  const { data: brandsList = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  const { data: vendorCounts = {} } = useQuery({
    queryKey: ["vendor-product-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("vendor_id")
        .eq("is_active", true)
        .not("vendor_id", "is", null);
      if (error) throw error;
      return (data || []).reduce<Record<string, number>>((acc, row) => {
        acc[row.vendor_id!] = (acc[row.vendor_id!] ?? 0) + 1;
        return acc;
      }, {});
    },
    staleTime: 1000 * 60 * 15,
  });

  // Resolve names from the unfiltered list so direct URLs to thin
  // categories still load products correctly.
  const categoryName = allCoreCategories.find((c) => c.slug === categorySlug)?.name || "";
  const vibeName = allVibeCategories.find((c) => c.slug === vibeSlug)?.name || "";

  const [sort, setSort] = useState<"newest" | "price-low" | "price-high" | "updated-desc" | "updated-asc">("newest");

  const moodSlug = searchParams.get("mood") || "";
  const moodName = allMoodCategories.find((c) => c.slug === moodSlug)?.name || "";

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

  // Build canonical URL — strip pagination params, preserve active filters
  const canonicalUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (categorySlug) params.set("category", categorySlug);
    if (vibeSlug) params.set("vibe", vibeSlug);
    if (moodSlug) params.set("mood", moodSlug);
    const qs = params.toString();
    return `${SITE_URL}/products${qs ? `?${qs}` : ""}`;
  }, [categorySlug, vibeSlug, moodSlug]);

  // SEO — filter-aware, brand-free metadata
  let seoTitle = `Shop All Products | Mood & Vibes`;
  let seoDescription = `Browse ${totalCount > 0 ? totalCount.toLocaleString() + " " : ""}curated products organized by mood, vibe, and lifestyle category. Find your mood. Shop the vibe.`;
  let seoKeywords = ["curated products", "mood shopping", "aesthetic finds", "vibe shopping", "mood and vibes"];
  let collectionName = "All Products | Mood & Vibes";
  let breadcrumbs = [
    { name: "Home", url: `${SITE_URL}/` },
    { name: "All Products", url: `${SITE_URL}/products` },
  ];

  if (categoryName) {
    seoTitle = `${categoryName} Products | Mood & Vibes`;
    seoDescription = `Browse curated ${categoryName} products. Find your mood. Shop the vibe on Mood & Vibes.`;
    seoKeywords = [categoryName, `${categoryName} products`, `curated ${categoryName}`, "mood and vibes"];
    collectionName = `${categoryName} Products | Mood & Vibes`;
    breadcrumbs = [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Products", url: `${SITE_URL}/products` },
      { name: categoryName, url: canonicalUrl },
    ];
  } else if (vibeName) {
    seoTitle = `${vibeName} Finds | Mood & Vibes`;
    seoDescription = `Browse ${vibeName} aesthetic finds curated by vibe. Find your mood. Shop the vibe on Mood & Vibes.`;
    seoKeywords = [vibeName, `${vibeName} aesthetic`, `${vibeName} products`, "mood and vibes"];
    collectionName = `${vibeName} Finds | Mood & Vibes`;
    breadcrumbs = [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Products", url: `${SITE_URL}/products` },
      { name: vibeName, url: canonicalUrl },
    ];
  } else if (moodName) {
    seoTitle = `${moodName} Mood Picks | Mood & Vibes`;
    seoDescription = `Products curated for a ${moodName} mood. Find your mood. Shop the vibe on Mood & Vibes.`;
    seoKeywords = [moodName, `${moodName} mood`, `${moodName} products`, "mood shopping", "mood and vibes"];
    collectionName = `${moodName} Mood Picks | Mood & Vibes`;
    breadcrumbs = [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Products", url: `${SITE_URL}/products` },
      { name: `${moodName} Mood`, url: canonicalUrl },
    ];
  }

  useSEO({
    title: seoTitle,
    rawTitle: true,
    description: seoDescription,
    url: canonicalUrl,
    keywords: seoKeywords,
    ogType: "website",
    collectionName,
    breadcrumbs,
  });

  const availableVendors = useMemo(() => {
    return brandsList
      .filter((b: any) => (vendorCounts[b.id] || 0) > 0)
      .map((b: any) => ({ id: b.id, name: toTitleCase(b.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [brandsList, vendorCounts]);

  const resetPage = useCallback(() => setPage(1), []);

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
        <Select
          value={filterVendor || "all"}
          onValueChange={(v) => {
            setFilterVendor(v === "all" ? "" : v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {availableVendors.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name} ({vendorCounts[v.id] || 0})
              </SelectItem>
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
          <SelectTrigger className="w-full sm:w-[180px]">
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
                <ProductCard product={p} ctaLabel="Discover Brand" />
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Product pagination">
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
                <span className="ml-2 hidden sm:inline">({totalCount.toLocaleString()} products)</span>
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
