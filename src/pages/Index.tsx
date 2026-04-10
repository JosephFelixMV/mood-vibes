import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useSEO } from "@/hooks/useSEO";
import { motion, AnimatePresence } from "framer-motion";
import { Shuffle, Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";
import { getProducts, getDailyPick, getRandomProduct } from "@/lib/supabase-queries";
import { useRateLimitedAction } from "@/hooks/useRateLimitedAction";

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
  useSEO({ title: "Home", description: "Discover products that match your mood and aesthetic. Curated finds for every vibe on Mood & Vibes." });
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => getProducts({ activeOnly: true }),
  });

  const countdown = useCountdownToMidnightUTC();

  const { data: dailyPick, isLoading: pickLoading } = useQuery({
    queryKey: ["daily-pick", countdown.expired ? "expired" : "active"],
    queryFn: getDailyPick,
    staleTime: countdown.expired ? 0 : 5 * 60 * 1000,
    refetchInterval: countdown.expired ? 5000 : false,
  });

  const [surprise, setSurprise] = useState<typeof dailyPick>(null);
  const [key, setKey] = useState(0);
  const isLoading = productsLoading || pickLoading;
  const { trigger, cooldown } = useRateLimitedAction(2000);

  const displayedProduct = dailyPick;

  const healthyProducts = products.filter((p) => !p.page_error);

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
      <section className="relative overflow-hidden py-24 md:py-36">
        <div className="container flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="font-heading text-4xl font-extrabold leading-tight tracking-tight md:text-6xl lg:text-7xl">
              Find your mood.
              <br />
              <span className="text-gradient">Shop the vibe.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-lg text-muted-foreground">
              Discover products that match your mood and aesthetic.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-10"
          >
            <Button
              size="lg"
              onClick={handleSurprise}
              disabled={isLoading || healthyProducts.length === 0 || cooldown}
              className="gap-2 rounded-full px-8 text-base font-semibold shadow-lg shadow-primary/20 transition-transform hover:scale-105"
            >
              <Shuffle className="h-5 w-5" /> {cooldown ? "Wait…" : "Surprise Me"}
            </Button>
          </motion.div>
        </div>

        {/* Decorative elements */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-72 w-72 rounded-full bg-accent/5 blur-3xl" />
      </section>

      {/* Surprise result */}
      <AnimatePresence mode="wait">
        {surprise && (
          <section className="container -mt-6 mb-12" key={key}>
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div className="mx-auto max-w-3xl">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-primary">
                  <Sparkles className="h-4 w-4" /> Your surprise pick
                </div>
                <ProductCard product={surprise} featured />
              </div>
            </motion.div>
          </section>
        )}
      </AnimatePresence>

      {/* Product of the Day */}
      <section className="container py-16">
        <div className="mb-8 flex flex-col items-center gap-3">
          <h2 className="text-center font-heading text-2xl font-bold tracking-tight md:text-3xl">
            🎁 Today's Pick
          </h2>
          <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm">
            <Clock className="h-4 w-4 text-primary" />
            <span>Next pick in</span>
            <span className="font-mono font-bold tracking-wider text-foreground">
              {countdown.h}:{countdown.m}:{countdown.s}
            </span>
          </div>
        </div>
        {isLoading ? (
          <div className="flex justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : displayedProduct ? (
          <div className="mx-auto max-w-3xl">
            <ProductCard product={displayedProduct} featured />
          </div>
        ) : (
          <p className="text-center text-muted-foreground">
            No products yet. Add some in the admin panel!
          </p>
        )}
      </section>
    </div>
  );
}
