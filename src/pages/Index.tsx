import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useSEO } from "@/hooks/useSEO";
import { motion, AnimatePresence } from "framer-motion";
import { Clock } from "lucide-react";
import ExternalCTA from "@/components/ExternalCTA";
import ProductCard from "@/components/ProductCard";
import { getProducts, getDailyPick, getRandomProduct, filterByRegion } from "@/lib/supabase-queries";
import { useRateLimitedAction } from "@/hooks/useRateLimitedAction";
import { useRegion } from "@/contexts/RegionContext";
import LaunchWelcomeModal from "@/components/LaunchWelcomeModal";

<LaunchWelcomeModal />;

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
  useSEO({
    title: "Mood & Vibes | Find Your Mood. Shop the Vibe.",
    rawTitle: true,
    description:
      "Daily curated product picks organized by mood, vibe, and lifestyle. Find your mood. Shop the vibe. Discover unique finds that match your aesthetic on Mood & Vibes.",
  });
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

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-10"
          >
            <ExternalCTA
              as="button"
              label={cooldown ? "Wait…" : "Discover More Brands"}
              onClick={handleSurprise}
              disabled={isLoading || healthyProducts.length === 0 || cooldown}
              size="lg"
              showIcon={false}
            />
          </motion.div>
        </div>

        {/* Decorative elements */}
        {/* removed decorative blobs */}
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

      {/* Product of the Day */}
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
    </div>
  );
}
