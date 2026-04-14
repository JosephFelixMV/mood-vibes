import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useProxiedImage } from "@/hooks/useProxiedImage";
import { formatPrice } from "@/lib/supabase-queries";
import type { Product } from "@/lib/supabase-queries";
import ProductDrawer from "@/components/ProductDrawer";

const SLIDE_EASING = [0.19, 1, 0.22, 1] as const;

interface DiscoveryTileProps {
  products: Product[];
  getRandomProduct: (pool: Product[], excludeId?: string) => Product | null;
}

function TileImage({ product }: { product: Product }) {
  const proxiedImage = useProxiedImage(product.image_url);
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#f5f5f5] flex items-center justify-center">
      {proxiedImage ? (
        <img
          src={proxiedImage}
          alt={product.name}
          className="h-full w-full object-contain"
          loading="eager"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-4xl text-muted-foreground">🛍️</div>
      )}
    </div>
  );
}

export default function DiscoveryTile({ products, getRandomProduct: getRandom }: DiscoveryTileProps) {
  const [pick, setPick] = useState<Product | null>(() =>
    products.length > 0 ? getRandom(products) : null
  );
  const [animKey, setAnimKey] = useState(0);
  const [sourcing, setSourcing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    <section className="mb-12">
      {/* Tile – click opens drawer */}
      <div
        className="mx-auto max-w-2xl cursor-pointer overflow-hidden rounded-sm border border-border bg-card transition-colors hover:border-foreground/20"
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

        <div className="p-5">
          <h3 className="font-heading text-lg font-semibold leading-tight">{pick.name}</h3>
          {pick.company_name && (
            <p className="mt-0.5 text-xs text-muted-foreground">{pick.company_name}</p>
          )}
          <p className="mt-2 font-heading text-xl font-bold text-primary">
            {formatPrice(pick.price)}
          </p>
        </div>
      </div>

      {/* Recessed Discover button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={handleDiscover}
          disabled={sourcing || products.length === 0}
          className="rounded-sm border border-border bg-muted/50 px-8 py-2.5 text-sm font-medium tracking-wide text-foreground/70 transition-all hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sourcing ? "Sourcing…" : "Discover"}
        </button>
      </div>

      {/* Drawer */}
      <ProductDrawer product={pick} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </section>
  );
}
