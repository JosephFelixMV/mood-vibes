import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProxiedImage } from "@/hooks/useProxiedImage";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, getCategories } from "@/lib/supabase-queries";
import type { Product } from "@/lib/supabase-queries";
import { Link } from "react-router-dom";

const SLIDE_EASING = [0.19, 1, 0.22, 1] as const;

interface DiscoveryTileProps {
  products: Product[];
  getRandomProduct: (pool: Product[], excludeId?: string) => Product | null;
}

function TileImage({ product }: { product: Product }) {
  const proxiedImage = useProxiedImage(product.image_url);
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#F2F0EA]">
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

function ProductDrawer({
  product,
  open,
  onOpenChange,
}: {
  product: Product;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const proxiedImage = useProxiedImage(product.image_url);

  const { data: extraImages = [] } = useQuery({
    queryKey: ["product-images", product.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_images")
        .select("*")
        .eq("product_id", product.id)
        .order("display_order");
      return data || [];
    },
    enabled: open,
  });

  const { data: specs = [] } = useQuery({
    queryKey: ["product-specs", product.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_specifications")
        .select("*")
        .eq("product_id", product.id)
        .order("display_order");
      return data || [];
    },
    enabled: open,
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
    staleTime: 1000 * 60 * 10,
  });

  const categorySlugMap = Object.fromEntries(allCategories.map((c) => [c.name, { slug: c.slug, type: c.type }]));

  const coreSet = [...new Set(product.category.split(",").map((c) => c.trim()).filter(Boolean))];
  const vibeSet = [...new Set((product.vibe_category || "").split(",").map((v) => v.trim()).filter(Boolean))];
  const moodSet = [...new Set((product.mood || "").split(",").map((m) => m.trim()).filter(Boolean))];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[40vw] sm:max-w-none p-0 border-l border-border">
        <ScrollArea className="h-full">
          <div className="flex flex-col">
            {/* Video or Hero image */}
            {product.video_url ? (
              <video
                src={product.video_url}
                autoPlay
                muted
                loop
                playsInline
                className="w-full aspect-video object-cover"
              />
            ) : proxiedImage ? (
              <img
                src={proxiedImage}
                alt={product.name}
                className="w-full aspect-[4/3] object-cover"
              />
            ) : null}

            {/* Extra images */}
            {extraImages.length > 0 && (
              <div className="flex gap-2 overflow-x-auto p-4">
                {extraImages.map((img) => (
                  <img
                    key={img.id}
                    src={img.image_url}
                    alt=""
                    className="h-20 w-20 flex-shrink-0 rounded-sm border border-border object-cover"
                  />
                ))}
              </div>
            )}

            <div className="space-y-5 p-6">
              {/* Title */}
              <SheetHeader className="p-0 text-left">
                <SheetTitle className="font-heading text-2xl font-bold leading-tight">
                  {product.name}
                </SheetTitle>
                {product.company_name && (
                  <SheetDescription className="text-sm text-muted-foreground">
                    {product.company_name}
                  </SheetDescription>
                )}
              </SheetHeader>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {coreSet.map((name) => {
                  const cat = categorySlugMap[name];
                  return (
                    <Link key={name} to={cat ? `/category/${cat.slug}` : "#"} onClick={() => onOpenChange(false)}>
                      <Badge className="bg-primary/90 text-primary-foreground cursor-pointer">{name}</Badge>
                    </Link>
                  );
                })}
                {vibeSet.map((name) => {
                  const cat = categorySlugMap[name];
                  return (
                    <Link key={name} to={cat ? `/vibes/${cat.slug}` : "#"} onClick={() => onOpenChange(false)}>
                      <Badge className="bg-[hsl(var(--badge-vibe))] text-[hsl(var(--badge-vibe-foreground))] cursor-pointer">{name}</Badge>
                    </Link>
                  );
                })}
                {moodSet.map((name) => {
                  const cat = categorySlugMap[name];
                  return (
                    <Link key={name} to={cat ? `/moods/${cat.slug}` : "#"} onClick={() => onOpenChange(false)}>
                      <Badge className="bg-[hsl(var(--badge-mood))] text-[hsl(var(--badge-mood-foreground))] cursor-pointer">{name}</Badge>
                    </Link>
                  );
                })}
              </div>

              {/* Price */}
              <div>
                <span className="font-heading text-2xl font-bold text-primary">
                  {formatPrice(product.price)}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {product.price_below_msrp ? "Seller often offers deals below MSRP" : "Price at retailer may vary"}
                </p>
              </div>

              {/* Description */}
              {product.description && (
                <div
                  className="prose prose-sm max-w-none text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              )}

              {/* Specs */}
              {specs.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-foreground/70">Specifications</h3>
                  <div className="divide-y divide-border">
                    {specs.map((s) => (
                      <div key={s.id} className="flex justify-between py-2 text-sm">
                        <span className="text-muted-foreground">{s.specification}</span>
                        <span className="font-medium text-foreground">{s.item_detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <Button asChild size="lg" className="w-full gap-2 rounded-sm">
                <a
                  href={product.affiliate_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View at Source <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
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
