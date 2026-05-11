import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useRegion } from "@/contexts/RegionContext";
import { useSEO } from "@/hooks/useSEO";
import { formatBrandName, formatBrandDescription } from "@/lib/brand-utils";

interface Brand {
  id: string;
  name: string;
  description: string | null;
  affiliate_url: string;
  regions: string[];
  is_active: boolean;
}

export default function Brands() {
  const { region } = useRegion();

  useSEO({
    title: "Our Brand Partners | Mood & Vibes",
    rawTitle: true,
    description:
      "Explore the curated selection of partner brands behind our product picks. Find your mood. Shop the vibe on Mood & Vibes.",
  });

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Brand[];
    },
  });

  const { data: vendorCounts = {} } = useQuery({
    queryKey: ["vendor-product-counts"],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("products")
          .select("vendor_id")
          .eq("is_active", true)
          .not("vendor_id", "is", null)
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        allData = allData.concat(data || []);
        hasMore = (data?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }
      const counts: Record<string, number> = {};
      allData.forEach((row) => {
        counts[row.vendor_id] = (counts[row.vendor_id] || 0) + 1;
      });
      return counts;
    },
  });

  const filteredBrands = brands.filter((b) => {
    const regions = b.regions || ["US"];
    return regions.includes(region) || regions.includes("Intl");
  });

  return (
    <div className="container py-12">
      <h1 className="mb-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">
        🏷️ Our Brands
      </h1>
      <p className="mb-10 text-muted-foreground">
        Curated brands we partner with
      </p>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" role="status">
            <span className="sr-only">Loading brands</span>
          </div>
        </div>
      ) : filteredBrands.length === 0 ? (
        <p className="py-20 text-center text-muted-foreground">
          No brands available in your region yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBrands.map((brand, i) => (
            <motion.div
              key={brand.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <a
                href={brand.affiliate_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Visit ${formatBrandName(brand.name)}`}
                className="group flex flex-col gap-1 rounded-2xl border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-lg font-semibold group-hover:text-primary transition-colors">
                      {formatBrandName(brand.name)}
                    </span>
                    {(vendorCounts[brand.id] || 0) > 0 && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {vendorCounts[brand.id]}
                      </span>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
{brand.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {formatBrandDescription(brand.description)}
                  </p>
                )}
                <p className="mt-2 text-[10px] italic text-muted-foreground">
                  *We may earn a commission on purchases made through this link.
                </p>
              </a>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
