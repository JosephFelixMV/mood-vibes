import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getCategories, getProductCountByCategory } from "@/lib/supabase-queries";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/hooks/useSEO";
import type { Category } from "@/lib/supabase-queries";
import { CategoryIcon } from "@/components/CategoryIcon";

export default function Categories() {
  useSEO({
    title: "Shop by Category | Mood & Vibes",
    rawTitle: true,
    description:
      "Browse curated product categories organized by lifestyle — home, fashion, wellness, and more. Find your mood. Shop the vibe.",
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", "core"],
    queryFn: () => getCategories("core"),
  });
  const { data: counts = {} } = useQuery({
    queryKey: ["product-counts"],
    queryFn: getProductCountByCategory,
  });

  const parents = categories.filter((c) => !c.parent_slug);
  const childrenOf = (parentSlug: string) =>
    categories.filter((c) => c.parent_slug === parentSlug);

  return (
    <div className="container py-12">
      <h1 className="mb-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">Categories</h1>
      <p className="mb-10 text-muted-foreground">Find products by what you're looking for</p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {parents.map((parent, i) => {
          const subs = childrenOf(parent.slug);
          return (
            <motion.div
              key={parent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border bg-card p-6"
            >
              <Link to={`/category/${parent.slug}`} className="mb-4 flex items-start gap-3 transition-colors hover:text-primary">
                <CategoryIcon category={parent} emojiClassName="text-3xl" imgClassName="h-8 w-8 rounded object-cover" />
                <div className="flex-1">
                  <h2 className="font-heading text-lg font-semibold">{parent.name}</h2>
                  {parent.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{parent.description}</p>
                  )}
                </div>
              </Link>
              {subs.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {subs.map((sub) => (
                     <Link
                      key={sub.id}
                      to={`/category/${sub.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                    >
                      <CategoryIcon category={sub} emojiClassName="text-sm" imgClassName="h-4 w-4 rounded object-cover" />
                      {sub.name}
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                        {counts[sub.name] ?? 0}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
