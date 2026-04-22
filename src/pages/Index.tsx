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
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Find Your Mood
                  </span>
                  <div className="flex flex-wrap justify-center gap-2">
                    {randomMoods.map((m, idx) => {
                      const driftAmount = 1.5 + idx * 0.5;
                      const driftDuration = 2.8 + idx * 0.6;
                      return (
                        <Link key={m.id} to={`/moods/${m.slug}`}>
                          <motion.div
                            animate={{ y: [0, -driftAmount, 0, driftAmount * 0.5, 0] }}
                            whileHover={{ y: -3, scale: 1.05 }}
                            transition={{
                              y: { duration: driftDuration, repeat: Infinity, ease: "easeInOut" },
                              scale: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
                            }}
                            className="will-change-transform"
                          >
                            <motion.div
                              className="mood-tag-pulse relative overflow-hidden rounded-full inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium uppercase tracking-[0.12em] cursor-pointer"
                              style={{
                                background: "linear-gradient(135deg, #121212 0%, #3F3F46 100%)",
                                color: "#FFFFFF",
                                border: "1.5px solid #D9732B",
                              }}
                              initial={{ boxShadow: "0 0 0 rgba(0,0,0,0)" }}
                              whileHover={{
                                boxShadow: "0 0 24px 4px rgba(217, 115, 43, 0.3)",
                                textShadow: "0 2px 8px rgba(255,255,255,0.3)",
                              }}
                              whileTap={{ scale: 0.97 }}
                              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                            >
                              <span className="relative z-10 flex items-center gap-1.5">
                                {m.icon && <span aria-hidden>{m.icon}</span>}
                                <span>{m.name}</span>
                              </span>
                              <motion.div
                                className="pointer-events-none absolute inset-0 rounded-full"
                                style={{
                                  background:
                                    "linear-gradient(120deg, transparent 0%, transparent 25%, rgba(217,115,43,0.35) 45%, rgba(242,161,84,0.3) 55%, transparent 75%, transparent 100%)",
                                  x: "-100%",
                                }}
                                whileHover={{ x: "100%" }}
                                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                              />
                            </motion.div>
                          </motion.div>
                        </Link>
                      );
                    })}
                  </div>
                  <Link
                    to="/moods"
                    className="mood-tag-pulse relative overflow-hidden inline-flex items-center justify-center gap-1.5 rounded-full uppercase font-medium tracking-[0.12em] whitespace-nowrap h-7 px-4 py-1 text-[11px] cursor-pointer"
                    style={{
                      background: "linear-gradient(135deg, #121212 0%, #3F3F46 100%)",
                      color: "#FFFFFF",
                      border: "1.5px solid rgba(217, 115, 43, 0.5)",
                    }}
                  >
                    <span className="relative z-10">See all moods</span>
                  </Link>
                </div>
              )}
              {randomVibes.length > 0 && (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Shop Your Vibe
                  </span>
                  <div className="flex flex-wrap justify-center gap-2">
                    {randomVibes.map((v, idx) => {
                      const driftAmount = 1.5 + idx * 0.5;
                      const driftDuration = 2.8 + idx * 0.6;
                      return (
                        <Link key={v.id} to={`/vibes/${v.slug}`}>
                          <motion.div
                            animate={{ y: [0, -driftAmount, 0, driftAmount * 0.5, 0] }}
                            whileHover={{ y: -3, scale: 1.05 }}
                            transition={{
                              y: { duration: driftDuration, repeat: Infinity, ease: "easeInOut" },
                              scale: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
                            }}
                            className="will-change-transform"
                          >
                            <motion.div
                              className="relative overflow-hidden rounded-full inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium uppercase tracking-[0.12em] cursor-pointer"
                              style={{
                                background: "linear-gradient(135deg, #F5D061 0%, #D9732B 100%)",
                                color: "#1C1209",
                              }}
                              initial={{ boxShadow: "0 0 0 rgba(0,0,0,0)", border: "1.5px solid transparent" }}
                              whileHover={{
                                boxShadow: "0 0 20px rgba(217,115,43,0.15)",
                                background: "#F8F7F4",
                                border: "1.5px solid #D9732B",
                                color: "#D9732B",
                              }}
                              whileTap={{ scale: 0.97 }}
                              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                            >
                              <span className="relative z-10 flex items-center gap-1.5">
                                {v.icon && <span aria-hidden>{v.icon}</span>}
                                <span>{v.name}</span>
                              </span>
                              <motion.div
                                className="pointer-events-none absolute inset-0 rounded-full"
                                style={{
                                  background:
                                    "linear-gradient(120deg, transparent 0%, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%, transparent 100%)",
                                  x: "-100%",
                                }}
                                whileHover={{ x: "100%" }}
                                transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                              />
                            </motion.div>
                          </motion.div>
                        </Link>
                      );
                    })}
                  </div>
                  <Link
                    to="/vibes"
                    className="mood-tag-pulse relative overflow-hidden inline-flex items-center justify-center gap-1.5 rounded-full uppercase font-medium tracking-[0.12em] whitespace-nowrap h-7 px-4 py-1 text-[11px] cursor-pointer"
                    style={{
                      background: "linear-gradient(135deg, #121212 0%, #3F3F46 100%)",
                      color: "#FFFFFF",
                      border: "1.5px solid rgba(217, 115, 43, 0.5)",
                    }}
                  >
                    <span className="relative z-10">Shop all vibes</span>
                  </Link>
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

      {/* Discover More Brands */}
      <section className="container pb-10">
        <div className="flex flex-col items-center gap-6">
          <ExternalCTA
            as="button"
            label={cooldown ? "Wait…" : "Discover More Brands"}
            onClick={handleSurprise}
            disabled={isLoading || healthyProducts.length === 0 || cooldown}
            size="lg"
            showIcon={false}
          />
          <AnimatePresence mode="wait">
            {surprise && (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="w-full max-w-3xl"
              >
                <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground text-center">
                  Your surprise pick
                </p>
                <ProductCard product={surprise} featured ctaLabel="Discover Brand" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
