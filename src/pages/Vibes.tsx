import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getPublicCategories, getProductCountByVibe } from "@/lib/supabase-queries";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/hooks/useSEO";

export default function Vibes() {
  useSEO({
    title: "Shop by Vibe | Aesthetic Finds | Mood & Vibes",
    rawTitle: true,
    description:
      "Discover products curated by aesthetic and vibe — from cozy minimalist to bold maximalist. Find your mood. Shop the vibe.",
  });

  const { data: vibes = [] } = useQuery({
    queryKey: ["public-categories", "vibe"],
    queryFn: () => getPublicCategories("vibe"),
  });
  const { data: counts = {} } = useQuery({
    queryKey: ["vibe-counts"],
    queryFn: getProductCountByVibe,
    staleTime: 1000 * 60 * 15,
  });

  return (
    <div className="container py-12">
      <h1 className="mb-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">
        ✨ Shop by Vibe
      </h1>
      <p className="mb-10 text-muted-foreground">
        Collections curated by aesthetic, not just function
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vibes.map((vibe, i) => (
          <motion.div
            key={vibe.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={`/vibes/${vibe.slug}`}
              className="group flex items-start gap-4 rounded-2xl border bg-card p-6 transition-all hover:border-accent/30 hover:shadow-md"
            >
              <CategoryIcon category={vibe} emojiClassName="text-3xl" imgClassName="h-8 w-8 rounded object-cover" />
              <div className="flex-1">
                <span className="font-heading text-lg font-semibold group-hover:text-accent">
                  {vibe.name}
                </span>
                {vibe.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{vibe.description}</p>
                )}
              </div>
              <Badge variant="secondary">{counts[vibe.slug] ?? 0}</Badge>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
