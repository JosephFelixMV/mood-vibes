import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getCategories, getProductCountByCategory } from "@/lib/supabase-queries";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/hooks/useSEO";

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

  return (
    <div className="container py-12">
      <h1 className="mb-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">Categories</h1>
      <p className="mb-10 text-muted-foreground">Find products by what you're looking for</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat, i) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={`/products?category=${cat.slug}`}
              className="group flex items-start gap-4 rounded-2xl border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md"
            >
              <span className="text-3xl">{cat.icon}</span>
              <div className="flex-1">
                <span className="font-heading text-lg font-semibold group-hover:text-primary">
                  {cat.name}
                </span>
                {cat.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{cat.description}</p>
                )}
              </div>
              <Badge variant="secondary">{counts[cat.name] ?? 0}</Badge>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
