import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

import { formatPrice } from "@/lib/supabase-queries";
import type { Product } from "@/lib/supabase-queries";
import ExternalCTA from "@/components/ExternalCTA";
import ProductDrawer from "@/components/ProductDrawer";
import ReportBrokenLink from "@/components/ReportBrokenLink";
import fallbackImage from "@/assets/fallback-product.png";

const SLIDE_EASING = [0.19, 1, 0.22, 1] as const;

interface DiscoveryTileProps {
  products: Product[];
  getRandomProduct: (pool: Product[], excludeId?: string) => Product | null;
  ctaLabel?: string;
}

function TileImage({ product }: { product: Product }) {
  return (
    <div className="relative w-full overflow-hidden bg-[#f7f7f5]" style={{ paddingTop: 'min(100%, 320px)' }}>
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="absolute inset-0 h-full w-full object-contain object-center p-2"
          loading="eager"
          onError={(e) => { (e.target as HTMLImageElement).src = fallbackImage; }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-4xl text-muted-foreground">🛍️</div>
      )}
    </div>
  );
}

export default function DiscoveryTile({ products, getRandomProduct: getRandom, ctaLabel }: DiscoveryTileProps) {
  const [pick, setPick] = useState<Product | null>(() =>
    products.length > 0 ? getRandom(products) : null
  );
  const [animKey, setAnimKey] = useState(0);
  const [sourcing, setSourcing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: allBrands = [] } = useQuery({
    queryKey: ["brands-list"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name");
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  const vendorName = pick?.vendor_id
    ? allBrands.find((b: any) => b.id === pick.vendor_id)?.name
    : null;

  // Sync pick if products load after mount
  if (products.length > 0 && !pick) {
    setPick(getRandom(products));
  }

  const handleDiscover = useCallback(() => {
    if (sourcing || products.length === 0) return;
    setSourcing(true);
    setTimeout(() => {
      const next = getRandom(products, pick?.id);
      setPick(next);
      setAnimKey((k) => k + 1);
      setSourcing(false);
    }, 1200);
  }, [sourcing, products, pick, getRandom]);

  if (!pick) return null;

  return (
    <section className="mb-10">
      {/* Tile – click opens drawer */}
      <div
        className="mx-auto max-w-md cursor-pointer overflow-hidden rounded-sm border border-border bg-card transition-colors hover:border-foreground/20"
        onClick={() => setDrawerOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setDrawerOpen(true)}
      >
        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={animKey}
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={{ duration: 0.5, ease: [...SLIDE_EASING] }}
            >
              <TileImage product={pick} />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="p-4">
          <h3 className="font-heading text-base font-semibold leading-tight">{pick.name}</h3>
          {pick.company_name && (
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium">{pick.company_name}</p>
          )}
          <p className="mt-1.5 font-heading text-lg font-bold text-primary">
            {formatPrice(pick.price)}
          </p>
          <div onClick={(e) => e.stopPropagation()}>
            <ExternalCTA href={pick.affiliate_url} label={ctaLabel || "Discover Brand"} size="sm" fullWidth className="mt-2.5" />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            {vendorName ? (
              <span className="text-[10px] text-muted-foreground">via {vendorName}</span>
            ) : <span />}
            <div onClick={(e) => e.stopPropagation()}>
              <ReportBrokenLink productId={pick.id} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <ExternalCTA
          as="button"
          label={sourcing ? "Sourcing…" : "Discover More"}
          onClick={handleDiscover}
          disabled={sourcing || products.length === 0}
          size="md"
          showIcon={false}
        />
      </div>

      {/* Drawer */}
      <ProductDrawer product={pick} open={drawerOpen} onOpenChange={setDrawerOpen} ctaLabel={ctaLabel} />
    </section>
  );
}
