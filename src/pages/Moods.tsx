import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getPublicCategories, getProductCountByMood } from "@/lib/supabase-queries";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/hooks/useSEO";

export default function Moods() {
  useSEO({
    title: "Shop by Mood | Mood & Vibes",
    rawTitle: true,
    description:
      "Find products that match how you're feeling. Mood-curated collections for every moment. Find your mood. Shop the vibe.",
  });

  const { data: moods = [] } = useQuery({
    queryKey: ["public-categories", "mood"],
    queryFn: () => getPublicCategories("mood"),
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["mood-counts"],
    queryFn: getProductCountByMood,
  });

  return (
    <div className="container py-12">
      <h1 className="mb-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">
        🎭 Shop by Mood
      </h1>
      <p className="mb-10 text-muted-foreground">
        Find products that match how you're feeling
      </p>

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
              <Badge variant="secondary">{counts[mood.slug] ?? 0}</Badge>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
