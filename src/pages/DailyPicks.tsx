import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/supabase-queries";
import type { Product } from "@/lib/supabase-queries";
import ProductCard from "@/components/ProductCard";
import ExternalCTA from "@/components/ExternalCTA";
import { useSEO } from "@/hooks/useSEO";
import fallbackImage from "@/assets/fallback-product.png";

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

async function fetchDailyPicks(): Promise<DailyPickRow[]> {
  // Ensure today's pick exists
  await supabase.rpc("get_or_create_daily_pick");

  // Fetch all picks newest first, joined to active products
  const { data, error } = await supabase
    .from("daily_picks")
    .select("pick_date, product:products!inner(*)")
    .eq("product.is_active", true)
    .eq("product.page_error", false)
    .order("pick_date", { ascending: false })
    .limit(500);

  if (error) throw error;
  return (data || []) as unknown as DailyPickRow[];
}

export default function DailyPicks() {
  useSEO({
    title: "Daily Picks Archive",
    description:
      "Browse every Mood & Vibes Product of the Day — today's curated pick plus the full archive of past daily picks.",
    url: "https://www.mood-and-vibes.com/daily-picks",
  });

  const { data: picks = [], isLoading } = useQuery({
    queryKey: ["daily-picks-archive"],
    queryFn: fetchDailyPicks,
    staleTime: 1000 * 60 * 5,
  });

  const todayIso = new Date().toISOString().split("T")[0];
  const todayPick = picks.find((p) => p.pick_date === todayIso) || picks[0];
  const pastPicks = picks.filter((p) => p !== todayPick);

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
          {pastPicks.length > 0 && (
            <section>
              <h2 className="mb-6 font-heading text-2xl font-semibold tracking-tight">
                Past Picks
              </h2>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:gap-8 lg:grid-cols-4">
                {pastPicks.map((p) => (
                  <PastPickCard key={p.pick_date} pick={p} />
                ))}
              </div>
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