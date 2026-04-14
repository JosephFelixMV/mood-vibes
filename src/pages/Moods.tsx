import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shuffle } from "lucide-react";
import { getCategories, getRandomProduct, filterByRegion } from "@/lib/supabase-queries";
import { supabase } from "@/integrations/supabase/client";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";
import { useSEO } from "@/hooks/useSEO";
import { useRateLimitedAction } from "@/hooks/useRateLimitedAction";
import { useRegion } from "@/contexts/RegionContext";
import type { Product } from "@/lib/supabase-queries";

export default function Moods() {
  const { region } = useRegion();
  useSEO({
    title: "Shop by Mood",
    description: "Find products that match your mood on Mood & Vibes.",
  });

  const { data: moods = [] } = useQuery({
    queryKey: ["categories", "mood"],
    queryFn: () => getCategories("mood"),
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["mood-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("mood")
        .eq("is_active", true)
        .not("mood", "is", null);
      if (error) throw error;
      const c: Record<string, number> = {};
      data.forEach((p) => {
        if (p.mood) {
          p.mood.split(",").forEach((m) => {
            const trimmed = m.trim();
            if (trimmed) c[trimmed] = (c[trimmed] || 0) + 1;
          });
        }
      });
      return c;
    },
  });


  return (
    <div className="container py-12">
      <h1 className="mb-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">
        🎭 Shop by Mood
      </h1>
      <p className="mb-10 text-muted-foreground">
        Find products that match how you're feeling
      </p>

      {/* Random Discovery */}
      {regionMoodProducts.length > 0 && (
        <div className="mb-10 rounded-2xl border bg-muted/30 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">🎲 Discover Something New</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRandom}
              disabled={cooldown || regionMoodProducts.length === 0}
              className="gap-1.5 rounded-full"
            >
              <Shuffle className="h-4 w-4" />
              {cooldown ? "Wait…" : "Random Pick"}
            </Button>
          </div>
          {randomPick && <ProductCard product={randomPick} featured />}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {moods.map((mood, i) => (
          <motion.div
            key={mood.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={`/moods/${mood.slug}`}
              className="group flex items-start gap-4 rounded-2xl border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md"
            >
              <CategoryIcon category={mood} emojiClassName="text-3xl" imgClassName="h-8 w-8 rounded object-cover" />
              <div className="flex-1">
                <span className="font-heading text-lg font-semibold group-hover:text-primary">
                  {mood.name}
                </span>
                {mood.description && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{mood.description}</p>
                )}
              </div>
              <Badge variant="secondary">{counts[mood.name] ?? 0}</Badge>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
