import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getCategories, getProductCountByCategory } from "@/lib/supabase-queries";
import { Badge } from "@/components/ui/badge";

export default function Categories() {
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });
  const { data: counts = {} } = useQuery({
    queryKey: ["product-counts"],
    queryFn: getProductCountByCategory,
  });

  return (
    <div className="container py-12">
      <h1 className="mb-2 font-heading text-3xl font-bold md:text-4xl">Categories</h1>
      <p className="mb-10 text-muted-foreground">Browse products by category</p>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {categories.map((cat, i) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              to={`/products?category=${cat.slug}`}
              className="group flex items-center gap-4 rounded-xl border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md"
            >
              <span className="text-3xl">{cat.icon}</span>
              <div className="flex-1">
                <span className="font-heading font-semibold group-hover:text-primary">
                  {cat.name}
                </span>
              </div>
              <Badge variant="secondary">{counts[cat.name] ?? 0}</Badge>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
