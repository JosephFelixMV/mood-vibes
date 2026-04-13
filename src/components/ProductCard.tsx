import { useEffect, useRef } from "react";

import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import ShareButton from "@/components/ShareButton";
import ReportBrokenLink from "@/components/ReportBrokenLink";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { trackProductClick } from "@/lib/track-click";
import { trackEvent } from "@/lib/track-event";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, getCategories } from "@/lib/supabase-queries";
import type { Product } from "@/lib/supabase-queries";
import { useProxiedImage } from "@/hooks/useProxiedImage";

interface ProductCardProps {
  product: Product;
  featured?: boolean;
}

export default function ProductCard({ product, featured }: ProductCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const proxiedImage = useProxiedImage(product.image_url);

  const { data: allCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
    staleTime: 1000 * 60 * 10,
  });

  const categorySlugMap = Object.fromEntries(allCategories.map((c) => [c.name, { slug: c.slug, type: c.type }]));

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
    // Fire async click-time validation (non-blocking)
    supabase.functions.invoke("validate-click", {
      body: { product_id: product.id },
    }).catch(() => {});
  };

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.35 }}
      className={`group overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-lg ${
        featured ? "md:flex md:items-stretch" : ""
      }`}
    >
      {/* Image */}
      <Link to={`/product/${(product as any).slug || product.id}`} aria-label={`View ${product.name}`} className={`relative block overflow-hidden bg-muted ${
        featured ? "md:w-1/2" : "aspect-[4/3]"
      }`}>
        {proxiedImage ? (
          <img
            src={proxiedImage}
            srcSet={`${proxiedImage} 1x, ${proxiedImage} 2x`}
            sizes={featured ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"}
            alt={product.name}
            className="sharp-image h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full min-h-[200px] items-center justify-center text-4xl text-muted-foreground">
            🛍️
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1">
          {(() => {
            const coreSet = [...new Set(product.category.split(",").map(c => c.trim()).filter(Boolean))];
            const vibeSet = [...new Set((product.vibe_category || "").split(",").map(v => v.trim()).filter(Boolean))];
            const moodSet = [...new Set((product.mood || "").split(",").map(m => m.trim()).filter(Boolean))];
            const pickRandom = (arr: string[]) => arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
            const picks: { name: string; type: string }[] = [];
            const core = pickRandom(coreSet);
            if (core) picks.push({ name: core, type: "core" });
            const vibe = pickRandom(vibeSet);
            if (vibe) picks.push({ name: vibe, type: "vibe" });
            const mood = pickRandom(moodSet);
            if (mood) picks.push({ name: mood, type: "mood" });
            return picks.map(({ name, type }) => {
              const cat = categorySlugMap[name];
              const to = cat
                ? type === "vibe" ? `/vibes/${cat.slug}` : type === "mood" ? `/moods/${cat.slug}` : `/category/${cat.slug}`
                : "#";
              return (
                <Link key={name} to={to} onClick={(e) => e.stopPropagation()}>
                  <Badge className="bg-primary/90 text-primary-foreground backdrop-blur-sm hover:bg-primary cursor-pointer">
                    {name}
                  </Badge>
                </Link>
              );
            });
          })()}
        </div>
      </Link>

      {/* Content */}
      <div className={`flex flex-col gap-3 p-5 ${featured ? "md:w-1/2 md:justify-center md:p-8" : ""}`}>
        <div>
          <Link
            to={`/product/${(product as any).slug || product.id}`}
            className="font-heading text-lg font-semibold leading-tight transition-colors hover:text-primary"
          >
            {product.name}
          </Link>
          {product.company_name && (
            <p className="mt-0.5 text-xs text-muted-foreground">{product.company_name}</p>
          )}
        </div>

        {product.description && (
          <div
            className={`text-sm text-muted-foreground [&_p]:inline [&_p]:m-0 [&_br]:hidden ${featured ? "line-clamp-3" : "line-clamp-2"}`}
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <div>
            <span className="font-heading text-xl font-bold text-primary">
              {formatPrice(product.price)}
            </span>
            <p className="text-[10px] text-muted-foreground">{product.price_below_msrp ? "Seller often offers deals below MSRP" : "Price at retailer may vary"}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <ReportBrokenLink productId={product.id} />
            <ShareButton product={product} />
            <Button asChild size="sm" className="gap-1.5 rounded-full" onClick={handleBuyClick}>
              <a href={product.affiliate_url} target="_blank" rel="noopener noreferrer" aria-label={`Buy ${product.name} (opens in new tab)`}>
                Buy Now <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
