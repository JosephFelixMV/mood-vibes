import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { ExternalLink, Info } from "lucide-react";
import ShareButton from "@/components/ShareButton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trackProductClick } from "@/lib/track-click";
import { trackEvent } from "@/lib/track-event";
import { formatPrice } from "@/lib/supabase-queries";
import type { Product } from "@/lib/supabase-queries";
import { useProxiedImage } from "@/hooks/useProxiedImage";

interface ProductCardProps {
  product: Product;
  featured?: boolean;
}

export default function ProductCard({ product, featured }: ProductCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

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
      <Link to={`/product/${product.id}`} className={`relative block overflow-hidden bg-muted ${
        featured ? "md:w-1/2" : "aspect-[4/3]"
      }`}>
        {product.image_url ? (
          <img
            src={product.image_url}
            srcSet={`${product.image_url} 1x, ${product.image_url} 2x`}
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
          {product.category.split(",").map((c) => (
            <Badge key={c} className="bg-primary/90 text-primary-foreground backdrop-blur-sm">
              {c.trim()}
            </Badge>
          ))}
        </div>
      </Link>

      {/* Content */}
      <div className={`flex flex-col gap-3 p-5 ${featured ? "md:w-1/2 md:justify-center md:p-8" : ""}`}>
        <div>
          <Link
            to={`/product/${product.id}`}
            className="font-heading text-lg font-semibold leading-tight transition-colors hover:text-primary"
          >
            {product.name}
          </Link>
          {product.company_name && (
            <p className="mt-0.5 text-xs text-muted-foreground">by {product.company_name}</p>
          )}
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Updated {format(new Date(product.updated_at), "MM/dd/yyyy")}
          </p>
        </div>

        {product.description && (
          <div
            className={`text-sm text-muted-foreground [&_p]:inline [&_p]:m-0 [&_br]:hidden ${featured ? "line-clamp-3" : "line-clamp-2"}`}
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="flex items-center gap-1 font-heading text-xl font-bold text-primary">
            {formatPrice(product.price)}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Prices may vary based on current seller deals.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </span>
          <div className="flex items-center gap-1.5">
            <ShareButton product={product} />
            <Button asChild size="sm" className="gap-1.5 rounded-full" onClick={handleBuyClick}>
              <a href={product.affiliate_url} target="_blank" rel="noopener noreferrer">
                Buy Now <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
