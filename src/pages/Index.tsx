import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useSEO } from "@/hooks/useSEO";
import { motion, AnimatePresence } from "framer-motion";
import { Clock } from "lucide-react";
import { Link } from "react-router-dom";
import ExternalCTA from "@/components/ExternalCTA";
import ProductCard from "@/components/ProductCard";
import { getDailyPick, getRandomProduct, filterByRegion, getCategories, type Product, type Category } from "@/lib/supabase-queries";
import { supabase } from "@/lib/supabase";
import { useRateLimitedAction } from "@/hooks/useRateLimitedAction";
import { useRegion } from "@/contexts/RegionContext";
import { setDiscoveryContext } from "@/lib/discovery-context";


function useCountdownToMidnightUTC() {
  const getRemaining = () => {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
  };

  const [seconds, setSeconds] = useState(getRemaining);

  useEffect(() => {
    const id = setInterval(() => setSeconds(getRemaining()), 1000);
    return () => clearInterval(id);
  }, []);

  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");

  return { h, m, s, expired: seconds === 0 };
}

export default function Index() {
  const { region } = useRegion();

  useEffect(() => {
    setDiscoveryContext({ type: "all", slug: "", name: "" });
  }, []);

  useSEO({
    title: "Mood & Vibes | Find Your Mood. Shop the Vibe.",
    rawTitle: true,
    description:
      "Daily curated product picks organized by mood, vibe, and lifestyle. Find your mood. Shop the vibe. Discover unique finds that match your aesthetic on Mood & Vibes.",
    url: "https://www.mood-and-vibes.com/",
    keywords: [
      "mood shopping",
      "curated products",
      "aesthetic finds",
      "vibe shopping",
      "daily product picks",
      "mood and vibes",
      "curated discovery",
    ],
    ogType: "website",
    siteSchema: true,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .eq("page_error", false)
        .order("date_added", { ascending: false })
        .limit(150);
      if (error) throw error;
      return data as Product[];
    },
  });

  const countdown = useCountdownToMidnightUTC();

  const { data: dailyPick, isLoading: pickLoading } = useQuery({
    queryKey: ["daily-pick", countdown.expired ? "expired" : "active"],
    queryFn: getDailyPick,
    staleTime: countdown.expired ? 0 : 5 * 60 * 1000,
    refetchInterval: countdown.expired ? 5000 : false,
  });

  const { data: moods = [] } = useQuery({
    queryKey: ["categories", "mood"],
    queryFn: () => getCategories("mood"),
  });
  const { data: vibes = [] } = useQuery({
    queryKey: ["categories", "vibe"],
    queryFn: () => getCategories("vibe"),
  });

  const { data: qualifiedMoods = [], isLoading: moodsLoading } = useQuery({
    queryKey: ["qualified-moods", moods.map((m) => m.slug).join(",")],
    queryFn: async () => {
      if (!moods.length) return [];
      const results = await Promise.all(
        moods.map(async (m) => {
          const { count } = await supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("is_active", true)
            .ilike("mood", `%${m.name}%`);
          return { ...m, productCount: count ?? 0 };
        }),
      );
      return results.filter((m) => m.productCount > 0);
    },
    enabled: moods.length > 0,
    staleTime: 1000 * 60 * 15,
  });

  const { data: qualifiedVibes = [], isLoading: vibesLoading } = useQuery({
    queryKey: ["qualified-vibes", vibes.map((v) => v.slug).join(",")],
    queryFn: async () => {
      if (!vibes.length) return [];
      const results = await Promise.all(
        vibes.map(async (v) => {
          const { count } = await supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("is_active", true)
            .ilike("vibe_category", `%${v.name}%`);
          return { ...v, productCount: count ?? 0 };
        }),
      );
      return results.filter((v) => v.productCount > 0);
    },
    enabled: vibes.length > 0,
    staleTime: 1000 * 60 * 15,
  });

  const [randomMoods, setRandomMoods] = useState<Category[]>([]);
  const [randomVibes, setRandomVibes] = useState<Category[]>([]);

  useEffect(() => {
    if (qualifiedMoods.length) {
      const shuffled = [...qualifiedMoods].sort(() => Math.random() - 0.5);
      setRandomMoods(shuffled.slice(0, 4));
    }
  }, [qualifiedMoods]);

  useEffect(() => {
    if (qualifiedVibes.length) {
      const shuffled = [...qualifiedVibes].sort(() => Math.random() - 0.5);
      setRandomVibes(shuffled.slice(0, 4));
    }
  }, [qualifiedVibes]);

  const [surprise, setSurprise] = useState<typeof dailyPick>(null);
  const [key, setKey] = useState(0);
  const isLoading = productsLoading || pickLoading;
  const { trigger, cooldown } = useRateLimitedAction(2000);

  const displayedProduct = dailyPick;

  const healthyProducts = filterByRegion(
    products.filter((p) => !p.page_error),
    region,
  );

  const handleSurprise = () => {
    trigger(() => {
      const next = getRandomProduct(healthyProducts, surprise?.id);
      setSurprise(next);
      setKey((k) => k + 1);
    });
  };

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="container flex flex-col items-center text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="font-heading text-4xl font-medium leading-tight tracking-tight md:text-6xl lg:text-7xl">
              Find your mood.
              <br />
              <span className="italic">Shop the vibe.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-lg text-muted-foreground">
              Discover products that match your mood and aesthetic.
            </p>
          </motion.div>

          {/* Mood & Vibe Selector */}
          {!moodsLoading && !vibesLoading && (randomMoods.length > 0 || randomVibes.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mt-10 w-full max-w-3xl space-y-5"
            >
              {randomMoods.length > 0 && (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex w-full max-w-xl items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Find Your Mood
                    </span>
                    <Link
                      to="/moods"
                      className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
                    >
                      See all moods →
                    </Link>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {randomMoods.map((m) => (
                      <Link
                        key={m.id}
                        to={`/moods/${m.slug}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        {m.icon && <span aria-hidden>{m.icon}</span>}
                        <span>{m.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {randomVibes.length > 0 && (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex w-full max-w-xl items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Shop Your Vibe
                    </span>
                    <Link
                      to="/vibes"
                      className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
                    >
                      Shop all vibes →
                    </Link>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {randomVibes.map((v) => (
                      <Link
                        key={v.id}
                        to={`/vibes/${v.slug}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                      >
                        {v.icon && <span aria-hidden>{v.icon}</span>}
                        <span>{v.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

        </div>
      </section>

      {/* Today's Pick — moved above Discover surprise result for new ordering */}
      <section className="container py-10">
        <div className="mb-8 flex flex-col items-center gap-3">
          <h2 className="text-center font-heading text-2xl font-bold tracking-tight md:text-3xl">🎁 Today's Pick</h2>
          <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm">
            <Clock className="h-4 w-4 text-primary" />
            <span>Next pick in</span>
            <span className="font-mono font-bold tracking-wider text-foreground">
              {countdown.h}:{countdown.m}:{countdown.s}
            </span>
          </div>
        </div>
        {isLoading ? (
          <div className="flex justify-center" role="status" aria-label="Loading">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : displayedProduct ? (
          <div className="mx-auto max-w-3xl">
            <ProductCard product={displayedProduct} featured ctaLabel="Discover Brand" />
          </div>
        ) : (
          <p className="text-center text-muted-foreground">No products yet. Add some in the admin panel!</p>
        )}
      </section>

      {/* Surprise result */}
      <AnimatePresence mode="wait">
        {surprise && (
          <section className="container -mt-6 mb-6" key={key}>
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div className="mx-auto max-w-3xl">
                <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Your surprise pick
                </p>
                <ProductCard product={surprise} featured ctaLabel="Discover Brand" />
              </div>
            </motion.div>
          </section>
        )}
      </AnimatePresence>
    </div>
  );
}
