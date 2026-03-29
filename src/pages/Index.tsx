import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSEO } from "@/hooks/useSEO";
import { motion, AnimatePresence } from "framer-motion";
import { Shuffle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";
import { getProducts, getProductOfTheDay, getRandomProduct } from "@/lib/supabase-queries";

export default function Index() {
  useSEO({ title: "Home", description: "Discover interesting products you never knew you needed. New surprise every day on Bored Shopper." });
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => getProducts({ activeOnly: true }),
  });

  const productOfDay = getProductOfTheDay(products);
  const [surprise, setSurprise] = useState<typeof productOfDay>(null);
  const [key, setKey] = useState(0);

  const handleSurprise = () => {
    const next = getRandomProduct(products, surprise?.id);
    setSurprise(next);
    setKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5 py-20 md:py-32">
        <div className="container flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="font-heading text-4xl font-bold leading-tight md:text-6xl lg:text-7xl">
              Not sure what to buy?
              <br />
              <span className="text-gradient">Let us decide.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-lg text-muted-foreground">
              Discover interesting products you never knew you needed. New surprise every day.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-8"
          >
            <Button
              size="lg"
              onClick={handleSurprise}
              disabled={isLoading || products.length === 0}
              className="gap-2 rounded-full px-8 text-base font-semibold shadow-lg shadow-primary/25 transition-transform hover:scale-105"
            >
              <Shuffle className="h-5 w-5" /> Surprise Me!
            </Button>
          </motion.div>
        </div>

        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
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
        <h2 className="mb-8 text-center font-heading text-2xl font-bold md:text-3xl">
          🎁 Product of the Day
        </h2>
        {isLoading ? (
          <div className="flex justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : productOfDay ? (
          <div className="mx-auto max-w-3xl">
            <ProductCard product={productOfDay} featured />
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
