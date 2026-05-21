import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/supabase-queries";
import type { Product } from "@/lib/supabase-queries";
import ProductCard from "@/components/ProductCard";
import ExternalCTA from "@/components/ExternalCTA";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";
import fallbackImage from "@/assets/fallback-product.png";

const PAGE_SIZE = 30;

interface DailyPickRow {
  pick_date: string;
  product: Product;
}

function formatPickDate(iso: string): string {
  // iso is YYYY-MM-DD — parse as local to avoid TZ shift
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function fetchTodayPick(): Promise<DailyPickRow | null> {
  await supabase.rpc("get_or_create_daily_pick");
  const todayIso = new Date().toISOString().split("T")[0];
  const { data: row, error } = await supabase
    .from("daily_picks")
    .select("pick_date, product_id")
    .eq("pick_date", todayIso)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const { data: product, error: pErr } = await supabase
    .from("products")
    .select("*")
    .eq("id", row.product_id)
    .eq("is_active", true)
    .eq("page_error", false)
    .maybeSingle();
  if (pErr) throw pErr;
  return product ? { pick_date: row.pick_date, product: product as Product } : null;
}

async function fetchPastPicks(
  page: number,
): Promise<{ rows: DailyPickRow[]; total: number }> {
  const todayIso = new Date().toISOString().split("T")[0];
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: pickRows, error, count } = await supabase
    .from("daily_picks")
    .select("pick_date, product_id", { count: "exact" })
    .lt("pick_date", todayIso)
    .order("pick_date", { ascending: false })
    .range(from, to);
  if (error) throw error;
  if (!pickRows || pickRows.length === 0) return { rows: [], total: count || 0 };

  const productIds = Array.from(new Set(pickRows.map((r) => r.product_id)));
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("*")
    .in("id", productIds)
    .eq("is_active", true)
    .eq("page_error", false);
  if (prodErr) throw prodErr;

  const productMap = new Map<string, Product>();
  (products || []).forEach((p) => productMap.set((p as Product).id, p as Product));

  const rows = pickRows
    .map((r) => {
      const product = productMap.get(r.product_id);
      return product ? { pick_date: r.pick_date, product } : null;
    })
    .filter((r): r is DailyPickRow => r !== null);

  return { rows, total: count || 0 };
}

export default function DailyPicks() {
  useSEO({
    title: "Daily Picks Archive",
    description:
      "Browse every Mood & Vibes Product of the Day — today's curated pick plus the full archive of past daily picks.",
    url: "https://www.mood-and-vibes.com/daily-picks",
  });

  const [page, setPage] = useState(1);

  const { data: todayPick, isLoading: todayLoading } = useQuery({
    queryKey: ["daily-picks-today"],
    queryFn: fetchTodayPick,
    staleTime: 1000 * 60 * 5,
  });

  const { data: pastData, isLoading: pastLoading } = useQuery({
    queryKey: ["daily-picks-past", page],
    queryFn: () => fetchPastPicks(page),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });

  const pastPicks = pastData?.rows ?? [];
  const totalPast = pastData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalPast / PAGE_SIZE));
  const isLoading = todayLoading;

  return (
    <div className="container py-12 md:py-16">
      <header className="mb-10 text-center">
        <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Product of the Day
        </p>
        <h1 className="font-heading text-4xl md:text-5xl font-semibold tracking-tight">
          Daily Picks
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          One curated find every day. Today's pick lives at the top — scroll for the full archive.
        </p>
      </header>

      {isLoading ? (
        <div className="py-24 text-center text-sm text-muted-foreground">Loading picks…</div>
      ) : !todayPick ? (
        <div className="py-24 text-center text-sm text-muted-foreground">
          No daily picks available yet.
        </div>
      ) : (
        <>
          {/* Hero — today's pick */}
          <section className="mb-16">
            <div className="mb-4 flex items-center justify-center gap-3">
              <span className="inline-block h-px w-8 bg-border" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Today · {formatPickDate(todayPick.pick_date)}
              </span>
              <span className="inline-block h-px w-8 bg-border" />
            </div>
            <FeaturedPick pick={todayPick} />
          </section>

          {/* Past picks grid */}
          {(pastPicks.length > 0 || pastLoading) && (
            <section>
              <h2 className="mb-6 font-heading text-2xl font-semibold tracking-tight">
                Past Picks
              </h2>
              {pastLoading && pastPicks.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:gap-8 lg:grid-cols-4">
                  {pastPicks.map((p) => (
                    <PastPickCard key={p.pick_date} pick={p} />
                  ))}
                </div>
              )}

              {totalPages > 1 && (
                <nav
                  className="mt-10 flex items-center justify-center gap-2"
                  aria-label="Daily picks pagination"
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
                      ({totalPast.toLocaleString()} past picks)
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
            </section>
          )}
        </>
      )}
    </div>
  );
}

function FeaturedPick({ pick }: { pick: DailyPickRow }) {
  const product = pick.product;
  const productUrl = `/product/${product.slug || product.id}`;
  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-sm border border-border bg-background md:flex">
      <Link to={productUrl} className="block md:w-1/2 bg-[#f7f7f5]">
        <div className="relative aspect-[4/5]">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="absolute inset-0 h-full w-full object-contain p-4"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                (e.target as HTMLImageElement).src = fallbackImage;
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-5xl text-muted-foreground">
              🛍️
            </div>
          )}
        </div>
      </Link>
      <div className="flex flex-col justify-center gap-3 p-6 md:w-1/2 md:p-10">
        {product.company_name && (
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {product.company_name}
          </span>
        )}
        <Link to={productUrl}>
          <h2 className="font-heading text-2xl font-semibold leading-tight hover:text-primary">
            {product.name}
          </h2>
        </Link>
        <span className="font-heading text-xl font-bold text-primary">
          {formatPrice(product.price)}
        </span>
        {product.description && (
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {product.description.replace(/<[^>]*>/g, "")}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ExternalCTA href={product.affiliate_url} label="Buy" />
          <Link
            to={productUrl}
            className="rounded-sm border border-border px-4 py-2 text-xs font-medium uppercase tracking-widest hover:border-foreground/30"
          >
            View details
          </Link>
        </div>
        <span className="mt-1 text-[10px] italic text-muted-foreground">
          *We may earn a commission on purchases made through this link.
        </span>
      </div>
    </div>
  );
}

function PastPickCard({ pick }: { pick: DailyPickRow }) {
  return (
    <div className="flex flex-col">
      <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {formatPickDate(pick.pick_date)}
      </div>
      <ProductCard product={pick.product} />
    </div>
  );
}