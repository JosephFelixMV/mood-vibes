import { useMemo } from "react";
import { Link, useParams, useSearchParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { getCategories, getProductsPaginated, filterByRegion } from "@/lib/supabase-queries";
import { useRegion } from "@/contexts/RegionContext";
import { useSEO } from "@/hooks/useSEO";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const SITE_URL = "https://www.mood-and-vibes.com";
const PAGE_SIZE = 30;

export default function ComboLanding() {
  const params = useParams<{ coreSlug?: string; vibeSlug?: string; moodSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { region } = useRegion();

  const isCoreCombo = !!params.coreSlug;
  const primarySlug = (params.coreSlug || params.vibeSlug)!;
  const moodSlug = params.moodSlug!;
  const primaryType: "core" | "vibe" = isCoreCombo ? "core" : "vibe";

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  const { data: primaryCats = [] } = useQuery({
    queryKey: ["categories", primaryType],
    queryFn: () => getCategories(primaryType),
  });
  const { data: moodCats = [] } = useQuery({
    queryKey: ["categories", "mood"],
    queryFn: () => getCategories("mood"),
  });

  const primary = primaryCats.find((c) => c.slug === primarySlug);
  const mood = moodCats.find((c) => c.slug === moodSlug);

  const queryEnabled = !!primary && !!mood;

  const { data: result, isLoading } = useQuery({
    queryKey: ["combo-products", primaryType, primary?.name, mood?.name, page],
    queryFn: () =>
      getProductsPaginated({
        ...(isCoreCombo
          ? { category: primary!.name }
          : { vibeCategory: primary!.name }),
        mood: mood!.name,
        page,
        pageSize: PAGE_SIZE,
        sort: "newest",
      }),
    enabled: queryEnabled,
  });

  const products = result?.data ?? [];
  const totalCount = result?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const regionProducts = useMemo(() => filterByRegion(products, region), [products, region]);

  const parentPath = isCoreCombo ? `/category/${primarySlug}` : `/vibes/${primarySlug}`;
  const parentUrl = `${SITE_URL}${parentPath}`;
  const selfPath = isCoreCombo
    ? `/category/${primarySlug}/mood/${moodSlug}`
    : `/vibe/${primarySlug}/mood/${moodSlug}`;
  const selfUrl = `${SITE_URL}${selfPath}`;

  const thin = queryEnabled && !isLoading && totalCount < 3;

  const titlePrefix = mood && primary
    ? `${mood.name} ${primary.name} — Curated Picks`
    : undefined;

  useSEO({
    title: titlePrefix ? `${titlePrefix} | Mood & Vibes` : undefined,
    rawTitle: true,
    description: mood && primary
      ? `${primary.name} products curated for a ${mood.name} mood. Shop the vibe on Mood & Vibes.`
      : undefined,
    url: selfUrl,
    noindex: thin,
    canonicalOverride: thin ? parentUrl : selfUrl,
    breadcrumbs: mood && primary ? [
      { name: "Home", url: `${SITE_URL}/` },
      { name: isCoreCombo ? "Categories" : "Vibes", url: `${SITE_URL}/${isCoreCombo ? "categories" : "vibes"}` },
      { name: primary.name, url: parentUrl },
      { name: `${mood.name} ${primary.name}`, url: selfUrl },
    ] : undefined,
  });

  if (
    (primaryCats.length > 0 && !primary) ||
    (moodCats.length > 0 && !mood) ||
    (isCoreCombo && primary && !primary.parent_slug)
  ) {
    return <Navigate to={parentPath} replace />;
  }

  const goToPage = (n: number) => {
    const next = new URLSearchParams(searchParams);
    if (n <= 1) next.delete("page");
    else next.set("page", String(n));
    setSearchParams(next);
  };

  const moodParentPath = `/moods/${moodSlug}`;

  return (
    <div className="container py-12">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
          {mood && primary ? `${mood.name} ${primary.name}` : "Loading…"}
        </h1>
        {mood && primary && (
          <p className="mt-2 text-muted-foreground">
            Curated {primary.name.toLowerCase()} picks for a {mood.name.toLowerCase()} mood.
          </p>
        )}
      </div>

      {/* Active filter tags */}
      {primary && mood && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            to={moodParentPath}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-sm hover:bg-muted"
            aria-label={`Remove ${primary.name} filter`}
          >
            <span>{primary.name}</span>
            <X className="h-3.5 w-3.5" />
          </Link>
          <Link
            to={parentPath}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-sm hover:bg-muted"
            aria-label={`Remove ${mood.name} filter`}
          >
            <span>{mood.name}</span>
            <X className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : regionProducts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-muted-foreground">No products match this combination.</p>
          <Button asChild variant="outline" className="mt-4 rounded-full">
            <Link to={parentPath}>Back to {primary?.name}</Link>
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {totalCount} product{totalCount !== 1 ? "s" : ""}
          </p>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {regionProducts.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <ProductCard product={p} />
              </motion.div>
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination className="mt-12">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 1) goToPage(page - 1);
                    }}
                    aria-disabled={page <= 1}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const n = idx + 1;
                  return (
                    <PaginationItem key={n}>
                      <PaginationLink
                        href="#"
                        isActive={n === page}
                        onClick={(e) => {
                          e.preventDefault();
                          goToPage(n);
                        }}
                      >
                        {n}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page < totalPages) goToPage(page + 1);
                    }}
                    aria-disabled={page >= totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
  );
}