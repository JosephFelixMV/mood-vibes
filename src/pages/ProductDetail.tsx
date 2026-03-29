import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ExternalLink, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getProduct, getProducts, getRandomProduct } from "@/lib/supabase-queries";
import { trackProductClick } from "@/lib/track-click";
import { useSEO } from "@/hooks/useSEO";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => getProduct(id!),
    enabled: !!id,
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => getProducts({ activeOnly: true }),
  });

  useSEO({
    title: product?.name,
    description: product?.description || `Check out ${product?.name} on Bored Shopper.`,
    image: product?.image_url || undefined,
    url: product ? `${window.location.origin}/product/${product.id}` : undefined,
  });

  const handleAnother = () => {
    const next = getRandomProduct(allProducts, id);
    if (next) navigate(`/product/${next.id}`);
  };

  const handleBuyClick = () => {
    if (product) trackProductClick(product.id);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">Product not found.</p>
      </div>
    );
  }

  return (
    <div className="container py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-4xl overflow-hidden rounded-2xl border bg-card shadow-sm md:flex"
      >
        <div className="bg-muted md:w-1/2">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex min-h-[300px] items-center justify-center text-6xl text-muted-foreground">
              🛍️
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center gap-4 p-8 md:w-1/2">
          <Badge className="w-fit">{product.category}</Badge>
          <h1 className="font-heading text-2xl font-bold md:text-3xl">{product.name}</h1>
          {product.company_name && (
            <p className="text-sm text-muted-foreground">by {product.company_name}</p>
          )}
          {product.description && (
            <p className="text-muted-foreground">{product.description}</p>
          )}
          <p className="font-heading text-3xl font-bold text-primary">{product.price}</p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg" className="gap-2" onClick={handleBuyClick}>
              <a href={product.affiliate_url} target="_blank" rel="noopener noreferrer">
                Buy Now <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleAnother}
              disabled={allProducts.length <= 1}
              className="gap-2"
            >
              Show me another <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
