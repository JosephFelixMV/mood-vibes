import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trackProductClick } from "@/lib/track-click";
import type { Product } from "@/lib/supabase-queries";

interface ProductCardProps {
  product: Product;
  featured?: boolean;
}

export default function ProductCard({ product, featured }: ProductCardProps) {
  const handleBuyClick = () => {
    trackProductClick(product.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.35 }}
      className={`group overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-lg ${
        featured ? "md:flex md:items-stretch" : ""
      }`}
    >
      {/* Image */}
      <div
        className={`relative overflow-hidden bg-muted ${
          featured ? "md:w-1/2" : "aspect-[4/3]"
        }`}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full min-h-[200px] items-center justify-center text-4xl text-muted-foreground">
            🛍️
          </div>
        )}
        <Badge className="absolute left-3 top-3 bg-primary/90 text-primary-foreground backdrop-blur-sm">
          {product.category}
        </Badge>
      </div>

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
        </div>

        {product.description && (
          <p className={`text-sm text-muted-foreground ${featured ? "" : "line-clamp-2"}`}>
            {product.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-heading text-xl font-bold text-primary">{product.price}</span>
          <Button asChild size="sm" className="gap-1.5" onClick={handleBuyClick}>
            <a href={product.affiliate_url} target="_blank" rel="noopener noreferrer">
              Buy Now <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
