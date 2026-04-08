import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getCategories, getProductCountByCategory } from "@/lib/supabase-queries";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/hooks/useSEO";
import type { Category } from "@/lib/supabase-queries";

export default function Categories() {
  useSEO({
    title: "Categories",
    description: "Browse products by category on Surprise Shopper.",
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", "core"],
    queryFn: () => getCategories("core"),
  });
  const { data: counts = {} } = useQuery({
    queryKey: ["product-counts"],
    queryFn: getProductCountByCategory,
  });

  // Separate parents and children
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
              <div className="mb-4 flex items-start gap-3">
                <span className="text-3xl">{parent.icon}</span>
                <div className="flex-1">
                  <h2 className="font-heading text-lg font-semibold">{parent.name}</h2>
                  {parent.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{parent.description}</p>
                  )}
                </div>
              </div>
              {subs.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {subs.map((sub) => (
                     <Link
                      key={sub.id}
                      to={`/category/${sub.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                    >
                      <span>{sub.icon}</span>
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
