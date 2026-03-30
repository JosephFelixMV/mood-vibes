import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ExternalLink, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getProduct, getProducts, getRandomProduct, getProductImages, getProductSpecifications, formatPrice } from "@/lib/supabase-queries";
import { trackProductClick } from "@/lib/track-click";
import { useSEO } from "@/hooks/useSEO";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentImage, setCurrentImage] = useState(0);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => getProduct(id!),
    enabled: !!id,
  });

  const { data: images = [] } = useQuery({
    queryKey: ["product-images", id],
    queryFn: () => getProductImages(id!),
    enabled: !!id,
  });

  const { data: specifications = [] } = useQuery({
    queryKey: ["product-specifications", id],
    queryFn: () => getProductSpecifications(id!),
    enabled: !!id,
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => getProducts({ activeOnly: true }),
  });

  useSEO({
    title: product?.name,
    description: product?.description || `Check out ${product?.name} on Surprise Shopper.`,
    image: product?.image_url || undefined,
    url: product ? `${window.location.origin}/product/${product.id}` : undefined,
  });

  // Images only (no video in gallery)
  const allImages = product ? [
    ...(product.image_url ? [product.image_url] : []),
    ...images.map((img) => img.image_url),
  ] : [];

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
        className="mx-auto max-w-5xl overflow-hidden rounded-2xl border bg-card"
      >
        {/* Top section: images + key info */}
        <div className="md:flex">
          {/* Image gallery */}
          <div className="relative md:w-1/2">
            <div className="relative aspect-square w-full overflow-hidden bg-muted">
              {allImages.length > 0 ? (
                <>
                  <img
                    src={allImages[currentImage]}
                    alt={product.name}
                    className="h-full w-full object-contain"
                  />
                  {allImages.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentImage((i) => (i - 1 + allImages.length) % allImages.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-card/80 p-1.5 backdrop-blur-sm transition-colors hover:bg-card"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setCurrentImage((i) => (i + 1) % allImages.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-card/80 p-1.5 backdrop-blur-sm transition-colors hover:bg-card"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-6xl text-muted-foreground">
                  🛍️
                </div>
              )}
            </div>
            {/* Thumbnail strip */}
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {allImages.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImage(i)}
                    className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                      i === currentImage ? "border-primary" : "border-transparent"
                    }`}
                  >
                    <img src={url} alt={`${product.name} ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="flex flex-col justify-center gap-4 p-8 md:w-1/2">
            <div className="flex flex-wrap gap-2">
              <Badge>{product.category}</Badge>
              {product.vibe_category && product.vibe_category.split(",").map((v) => (
                <Badge key={v} variant="secondary">{v.trim()}</Badge>
              ))}
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">{product.name}</h1>
            {product.company_name && (
              <p className="text-sm text-muted-foreground">by {product.company_name}</p>
            )}
            <p className="font-heading text-3xl font-bold text-primary">{formatPrice(product.price)}</p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg" className="gap-2 rounded-full" onClick={handleBuyClick}>
                <a href={product.affiliate_url} target="_blank" rel="noopener noreferrer">
                  Buy Now <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleAnother}
                disabled={allProducts.length <= 1}
                className="gap-2 rounded-full"
              >
                Show me another <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Video */}
        {product.video_url && (
          <div className="border-t px-8 py-6">
            <h2 className="mb-3 font-heading text-lg font-semibold">Product Video</h2>
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
              <video controls className="h-full w-full object-contain">
                <source src={product.video_url} type="video/mp4" />
                <source src={`${product.video_url}.mp4`} />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div className="border-t px-8 py-6">
            <h2 className="mb-3 font-heading text-lg font-semibold">About this product</h2>
            <div
              className="prose prose-sm max-w-none text-muted-foreground leading-relaxed [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </div>
        )}

        {/* Specifications */}
        {specifications.length > 0 && (
          <div className="border-t px-8 py-6">
            <h2 className="mb-3 font-heading text-lg font-semibold">Specifications</h2>
            <div className="overflow-hidden rounded-lg border">
              {specifications.map((spec, i) => (
                <div
                  key={spec.id}
                  className={`flex ${i % 2 === 0 ? "bg-muted/50" : "bg-background"}`}
                >
                  <div className="w-1/3 px-4 py-3 font-medium text-sm">{spec.item_detail}</div>
                  <div className="w-2/3 border-l px-4 py-3 text-sm text-muted-foreground">{spec.specification}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
