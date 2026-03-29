import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getCategories, getProductCountByCategory } from "@/lib/supabase-queries";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/hooks/useSEO";
import { useMemo, useRef } from "react";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function Categories() {
  useSEO({
    title: "Categories",
    description: "Browse products by category on Bored Shopper.",
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });
  const { data: counts = {} } = useQuery({
    queryKey: ["product-counts"],
    queryFn: getProductCountByCategory,
  });

  const grouped = useMemo(() => {
    const map: Record<string, typeof categories> = {};
    categories.forEach((cat) => {
      const letter = cat.name[0]?.toUpperCase() || "#";
      (map[letter] ??= []).push(cat);
    });
    return map;
  }, [categories]);

  const activeLetters = useMemo(() => new Set(Object.keys(grouped)), [grouped]);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollTo = (letter: string) => {
    sectionRefs.current[letter]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="container py-12">
      <h1 className="mb-2 font-heading text-3xl font-bold md:text-4xl">Categories</h1>
      <p className="mb-10 text-muted-foreground">Browse products by category</p>

      <div className="flex gap-6">
        {/* A-Z Sidebar */}
        <nav className="sticky top-20 hidden h-fit flex-col items-center gap-0.5 md:flex">
          {ALPHABET.map((letter) => (
            <button
              key={letter}
              onClick={() => scrollTo(letter)}
              disabled={!activeLetters.has(letter)}
              className={`w-8 rounded px-1 py-0.5 text-xs font-semibold transition-colors ${
                activeLetters.has(letter)
                  ? "text-primary hover:bg-primary/10"
                  : "cursor-default text-muted-foreground/30"
              }`}
            >
              {letter}
            </button>
          ))}
        </nav>

        {/* Category list grouped by letter */}
        <div className="flex-1 space-y-8">
          {ALPHABET.filter((l) => activeLetters.has(l)).map((letter) => (
            <div
              key={letter}
              ref={(el) => { sectionRefs.current[letter] = el; }}
            >
              <h2 className="mb-3 font-heading text-lg font-bold text-primary">{letter}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[letter]?.map((cat, i) => (
                  <motion.div
                    key={cat.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
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
          ))}
        </div>
      </div>
    </div>
  );
}
