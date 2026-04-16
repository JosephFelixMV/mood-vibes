import { useEffect, useMemo, useRef, useState } from "react";

import { motion } from "framer-motion";

import ShareButton from "@/components/ShareButton";
import ReportBrokenLink from "@/components/ReportBrokenLink";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import ExternalCTA from "@/components/ExternalCTA";
import { useQuery } from "@tanstack/react-query";
import { trackProductClick } from "@/lib/track-click";
import { trackEvent } from "@/lib/track-event";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, getCategories } from "@/lib/supabase-queries";
import { supabase as sb } from "@/integrations/supabase/client";
import type { Product } from "@/lib/supabase-queries";

import { useIsMobile } from "@/hooks/use-mobile";
import ProductDrawer from "@/components/ProductDrawer";
import fallbackImage from "@/assets/fallback-product.png";

interface ProductCardProps {
  product: Product;
  featured?: boolean;
  ctaLabel?: string;
}

export default function ProductCard({ product, featured, ctaLabel = "Buy" }: ProductCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const proxiedImage = product.image_url;
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: allCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
    staleTime: 1000 * 60 * 10,
  });


  const categorySlugMap = Object.fromEntries(allCategories.map((c) => [c.name, { slug: c.slug, type: c.type }]));

  // Pick one random tag per taxonomy type, stable across re-renders
  const tagPicks = useMemo(() => {
    const pickRandom = (arr: string[]) => arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
    const vibeSet = [...new Set((product.vibe_category || "").split(",").map(v => v.trim()).filter(Boolean))];
    const moodSet = [...new Set((product.mood || "").split(",").map(m => m.trim()).filter(Boolean))];
    const picks: { name: string; type: string }[] = [];
    const vibe = pickRandom(vibeSet);
    if (vibe) picks.push({ name: vibe, type: "vibe" });
    const mood = pickRandom(moodSet);
    if (mood) picks.push({ name: mood, type: "mood" });
    return picks;
  }, [product.id]);
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
                onError={(e) => { (e.target as HTMLImageElement).src = fallbackImage; }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-4xl text-muted-foreground">
                🛍️
              </div>
            )}
          </div>
          <div className="absolute left-3 top-3 flex flex-wrap gap-1">
            {tagPicks.map(({ name, type }, tagIndex) => {
              const cat = categorySlugMap[name];
              const to = cat
                ? type === "vibe" ? `/vibes/${cat.slug}` : type === "mood" ? `/moods/${cat.slug}` : `/category/${cat.slug}`
                : "#";
              const badgeStyle: React.CSSProperties =
                type === "vibe"
                  ? { background: "linear-gradient(135deg, #F5D061 0%, #D9732B 100%)", backgroundSize: "200% 200%", backgroundPosition: "left center", color: "#1C1209" }
                  : type === "mood"
                  ? { background: "linear-gradient(135deg, #121212 0%, #3F3F46 100%)", backgroundSize: "200% 200%", backgroundPosition: "left center", color: "#FFFFFF", border: "1.5px solid #D9732B" }
                  : { background: "linear-gradient(135deg, #D9732B 0%, #F2A154 100%)", backgroundSize: "200% 200%", backgroundPosition: "left center", color: "#FFFFFF" };
              const glowColor =
                type === "vibe"
                  ? "rgba(245, 208, 97, 0.3)"
                  : type === "mood"
                  ? "rgba(217, 115, 43, 0.3)"
                  : "rgba(242, 161, 84, 0.3)";
              const haloShadow = `0 0 24px 4px ${glowColor}`;
              const isMood = type === "mood";
              const shimmerGradient = isMood
                ? "linear-gradient(120deg, transparent 0%, transparent 25%, rgba(217,115,43,0.35) 45%, rgba(242,161,84,0.3) 55%, transparent 75%, transparent 100%)"
                : "linear-gradient(120deg, transparent 0%, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%, transparent 100%)";
              const shimmerDuration = isMood ? 0.5 : 0.6;

              const handleMouseMove = isMood ? (e: React.MouseEvent<HTMLDivElement>) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const lightLeak = e.currentTarget.querySelector<HTMLDivElement>("[data-light-leak]");
                if (lightLeak) {
                  lightLeak.style.background = `radial-gradient(circle 40px at ${x}px ${y}px, rgba(217,115,43,0.45) 0%, transparent 100%)`;
                }
              } : undefined;

              const handleMouseLeave = isMood ? (e: React.MouseEvent<HTMLDivElement>) => {
                const lightLeak = e.currentTarget.querySelector<HTMLDivElement>("[data-light-leak]");
                if (lightLeak) lightLeak.style.background = "transparent";
              } : undefined;

              // Buoyancy: staggered drift per tag
              const driftAmount = 1.5 + tagIndex * 0.5;
              const driftDuration = 2.8 + tagIndex * 0.6;

              return (
                <Link key={name} to={to} onClick={(e) => e.stopPropagation()}>
                  <motion.div
                    animate={{ y: [0, -driftAmount, 0, driftAmount * 0.5, 0] }}
                    whileHover={{ y: -3, scale: 1.05 }}
                    transition={{
                      y: { duration: driftDuration, repeat: Infinity, ease: "easeInOut" },
                      scale: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
                    }}
                    className="will-change-transform"
                  >
                    <motion.div
                      className={`relative overflow-hidden rounded-full ${isMood ? "mood-tag-pulse" : ""}`}
                      style={badgeStyle}
                      initial={{ scale: 1, boxShadow: "0 0 0 rgba(0,0,0,0)", backgroundPosition: "left center", filter: "brightness(1)", border: type === "vibe" ? "1.5px solid transparent" : undefined }}
                      whileHover={{
                        boxShadow: type === "vibe" ? "0 0 20px rgba(217,115,43,0.15)" : haloShadow,
                        backgroundPosition: "right center",
                        filter: "brightness(1)",
                        background: type === "vibe" ? "#F8F7F4" : undefined,
                        border: type === "vibe" ? "1.5px solid #D9732B" : undefined,
                        color: type === "vibe" ? "#D9732B" : undefined,
                      }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                    >
                    <motion.div
                      initial={{ letterSpacing: "0.12em", textShadow: "none" }}
                      whileHover={{
                        letterSpacing: "0.18em",
                        ...(isMood ? { textShadow: "0 2px 8px rgba(255,255,255,0.3)" } : {}),
                      }}
                      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                    >
                      <Badge className="bg-transparent border-0 backdrop-blur-sm cursor-pointer uppercase text-[9px] font-medium tracking-[0.12em] px-3 py-1 whitespace-nowrap" style={{ color: "inherit" }}>
                        {name}
                      </Badge>
                    </motion.div>
                    {/* Light-leak layer for Mood */}
                    {isMood && (
                      <div data-light-leak className="pointer-events-none absolute inset-0 rounded-full transition-none" />
                    )}
                    {/* Satin shimmer sweep */}
                    <motion.div
                      className="pointer-events-none absolute inset-0 rounded-full"
                      style={{
                        background: shimmerGradient,
                        x: "-100%",
                      }}
                      whileHover={{ x: "100%" }}
                      transition={{ duration: shimmerDuration, ease: [0.4, 0, 0.2, 1] }}
                    />
                    </motion.div>
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

          {product.company_name && (
            <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
              {product.company_name}
            </span>
          )}

          <span className="font-heading text-base font-bold text-primary">
            {formatPrice(product.price)}
          </span>

          <div className="flex items-center gap-1 mt-1">
            <ExternalCTA href={product.affiliate_url} label={ctaLabel} onClick={handleBuyClick} size="sm" />
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
