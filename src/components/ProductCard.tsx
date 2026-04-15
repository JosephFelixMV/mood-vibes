import { useEffect, useMemo, useRef, useState } from "react";

import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import ShareButton from "@/components/ShareButton";
import ReportBrokenLink from "@/components/ReportBrokenLink";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { trackProductClick } from "@/lib/track-click";
import { trackEvent } from "@/lib/track-event";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, getCategories } from "@/lib/supabase-queries";
import type { Product } from "@/lib/supabase-queries";
import { useProxiedImage } from "@/hooks/useProxiedImage";
import { useIsMobile } from "@/hooks/use-mobile";
import ProductDrawer from "@/components/ProductDrawer";

interface ProductCardProps {
  product: Product;
  featured?: boolean;
  ctaLabel?: string;
}

export default function ProductCard({ product, featured, ctaLabel = "Buy" }: ProductCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const proxiedImage = useProxiedImage(product.image_url);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: allCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
    staleTime: 1000 * 60 * 10,
  });

  const { data: allBrands = [] } = useQuery({
    queryKey: ["brands-list"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name");
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  const vendorName = product.vendor_id
    ? allBrands.find((b: any) => b.id === product.vendor_id)?.name
    : null;

  const categorySlugMap = Object.fromEntries(allCategories.map((c) => [c.name, { slug: c.slug, type: c.type }]));

  // Pick one random tag per taxonomy type, stable across re-renders
  const tagPicks = useMemo(() => {
    const pickRandom = (arr: string[]) => arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
    const coreSet = [...new Set(product.category.split(",").map(c => c.trim()).filter(Boolean))];
    const vibeSet = [...new Set((product.vibe_category || "").split(",").map(v => v.trim()).filter(Boolean))];
    const moodSet = [...new Set((product.mood || "").split(",").map(m => m.trim()).filter(Boolean))];
    const picks: { name: string; type: string }[] = [];
    const core = pickRandom(coreSet);
    if (core) picks.push({ name: core, type: "core" });
    const vibe = pickRandom(vibeSet);
    if (vibe) picks.push({ name: vibe, type: "vibe" });
    const mood = pickRandom(moodSet);
    if (mood) picks.push({ name: mood, type: "mood" });
    return picks;
  }, [product.id]); // stable per product instance
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackEvent(product.id, "view");
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [product.id]);

  const handleBuyClick = () => {
    trackProductClick(product.id);
    trackEvent(product.id, "click");
    supabase.functions.invoke("validate-click", {
      body: { product_id: product.id },
    }).catch(() => {});
  };

  const productUrl = `/product/${(product as any).slug || product.id}`;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't intercept if clicking on a link/button inside
    if ((e.target as HTMLElement).closest("a, button")) return;
    
    if (isMobile) {
      e.preventDefault();
      setDrawerOpen(true);
    } else {
      navigate(productUrl);
    }
  };

  return (
    <>
      <motion.div
        ref={cardRef}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.35 }}
        onClick={handleCardClick}
        className={`group overflow-hidden rounded-sm border border-border bg-background transition-all hover:border-foreground/20 hover:-translate-y-0.5 cursor-pointer ${
          featured ? "md:flex md:items-stretch" : ""
        }`}
      >
        {/* Image */}
        <div className={`relative block overflow-hidden ${featured ? "md:w-1/2" : ""}`}>
          <div className={`relative ${featured ? "aspect-[4/5] md:aspect-auto md:h-full md:min-h-[360px]" : ""} bg-[#f7f7f5]`} style={featured ? undefined : { paddingTop: '100%' }}>
            {proxiedImage ? (
              <img
                src={proxiedImage}
                srcSet={`${proxiedImage} 1x, ${proxiedImage} 2x`}
                sizes={featured ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"}
                alt={product.name}
                className="sharp-image absolute inset-0 h-full w-full object-contain object-center p-2 transition-transform duration-500 group-hover:scale-[1.02]"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-4xl text-muted-foreground">
                🛍️
              </div>
            )}
          </div>
          <div className="absolute left-3 top-3 flex flex-wrap gap-1">
            {tagPicks.map(({ name, type }) => {
              const cat = categorySlugMap[name];
              const to = cat
                ? type === "vibe" ? `/vibes/${cat.slug}` : type === "mood" ? `/moods/${cat.slug}` : `/category/${cat.slug}`
                : "#";
              const badgeColor =
                type === "vibe"
                  ? "bg-[hsl(var(--badge-vibe))] border border-[hsl(var(--badge-vibe-border))] text-[hsl(var(--badge-vibe-foreground))]"
                  : type === "mood"
                  ? "bg-[hsl(var(--badge-mood))] text-[hsl(var(--badge-mood-foreground))]"
                  : "bg-[hsl(var(--badge-core))] border border-[hsl(var(--badge-core-border))] text-[hsl(var(--badge-core-foreground))]";
              const haloShadow =
                type === "vibe"
                  ? "0 4px 20px rgba(209, 198, 170, 0.45)"
                  : type === "mood"
                  ? "0 4px 20px rgba(180, 180, 190, 0.35)"
                  : "0 4px 20px rgba(255, 255, 255, 0.5)";
              return (
                <Link key={name} to={to} onClick={(e) => e.stopPropagation()}>
                  <motion.div
                    className="relative overflow-hidden rounded-full"
                    initial={{ y: 0, boxShadow: "0 0 0 rgba(0,0,0,0)" }}
                    whileHover={{ y: -3, boxShadow: haloShadow }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  >
                    <motion.div
                      initial={{ letterSpacing: "0.12em" }}
                      whileHover={{ letterSpacing: "0.18em" }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    >
                      <Badge className={`${badgeColor} backdrop-blur-sm cursor-pointer uppercase text-[10px] font-medium tracking-[0.12em] px-5 py-2 whitespace-nowrap`}>
                        {name}
                      </Badge>
                    </motion.div>
                    {/* Satin shimmer sweep */}
                    <motion.div
                      className="pointer-events-none absolute inset-0 rounded-full"
                      style={{
                        background: "linear-gradient(120deg, transparent 0%, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%, transparent 100%)",
                        x: "-100%",
                      }}
                      whileHover={{ x: "100%" }}
                      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                    />
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className={`flex flex-col gap-2 p-4 ${featured ? "md:w-1/2 md:justify-center md:p-8" : ""}`}>
          <span className="font-heading text-sm font-semibold leading-snug transition-colors hover:text-primary">
            {product.name}
          </span>

          <span className="font-heading text-base font-bold text-primary">
            {formatPrice(product.price)}
          </span>

          {vendorName && (
            <span className="text-[10px] text-muted-foreground">via {vendorName}</span>
          )}

          <div className="flex items-center gap-1 mt-1">
            <Button asChild size="sm" className="h-7 gap-1 rounded-sm text-xs" onClick={handleBuyClick}>
              <a href={product.affiliate_url} target="_blank" rel="noopener noreferrer" aria-label={`${ctaLabel} ${product.name} (opens in new tab)`}>
                {ctaLabel} <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </Button>
            <ReportBrokenLink productId={product.id} />
            <ShareButton product={product} />
          </div>
        </div>
      </motion.div>

      {/* Mobile drawer */}
      {isMobile && (
        <ProductDrawer product={product} open={drawerOpen} onOpenChange={setDrawerOpen} ctaLabel={ctaLabel === "Buy" ? undefined : ctaLabel} />
      )}
    </>
  );
}
