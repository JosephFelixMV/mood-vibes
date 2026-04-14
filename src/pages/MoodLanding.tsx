import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { getCategories, getRandomProduct, filterByRegion } from "@/lib/supabase-queries";
import DiscoveryTile from "@/components/DiscoveryTile";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";
import { useSEO } from "@/hooks/useSEO";

import { useRegion } from "@/contexts/RegionContext";
import type { Product } from "@/lib/supabase-queries";

export default function MoodLanding() {
  const { slug } = useParams<{ slug: string }>();
  const { region } = useRegion();
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const { data: moods = [] } = useQuery({
    queryKey: ["categories", "mood"],
    queryFn: () => getCategories("mood"),
  });

  const mood = moods.find((m) => m.slug === slug);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["mood-products", mood?.name, sort],
    queryFn: async () => {
      if (!mood) return [];
      let query = supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .ilike("mood", `%${mood.name}%`);
      
      query = sort === "newest"
        ? query.order("date_added", { ascending: false })
        : query.order("date_added", { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!mood,
  });

  const regionProducts = filterByRegion(products, region);


  useSEO({
    title: mood?.name || "Mood",
    description: mood?.description || `Shop ${mood?.name || "mood"} products on Mood & Vibes.`,
  });

  if (!mood) {
    return <div className="container py-20 text-center text-muted-foreground">Mood not found.</div>;
  }

  return (
    <div className="container py-12">
      <div className="mb-8 flex items-start gap-4">
        <CategoryIcon category={mood} emojiClassName="text-4xl" imgClassName="h-12 w-12 rounded object-cover" />
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">{mood.name}</h1>
          {mood.description && <p className="mt-2 text-muted-foreground">{mood.description}</p>}
        </div>
      </div>

      {/* Discovery tile */}
      {regionProducts.length > 0 && (
        <DiscoveryTile products={regionProducts} getRandomProduct={getRandomProduct} />
      )}

      {/* Sort */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">All {mood.name} Products ({regionProducts.length})</h2>
        <div className="flex gap-2">
          <Button
            variant={sort === "newest" ? "default" : "outline"}
            size="sm"
            onClick={() => setSort("newest")}
            className="rounded-full"
          >
            Newest
          </Button>
          <Button
            variant={sort === "oldest" ? "default" : "outline"}
            size="sm"
            onClick={() => setSort("oldest")}
            className="rounded-full"
          >
            Oldest
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : regionProducts.length === 0 ? (
        <p className="py-20 text-center text-muted-foreground">No products available in your region for this mood.</p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {regionProducts.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <ProductCard product={p} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
