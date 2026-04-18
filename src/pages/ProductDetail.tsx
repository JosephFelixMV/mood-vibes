import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import ExternalCTA from "@/components/ExternalCTA";
import ReportBrokenLink from "@/components/ReportBrokenLink";
import ShareButton from "@/components/ShareButton";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getProduct,
  getRandomProduct,
  getProductImages,
  getProductSpecifications,
  getCategories,
  formatPrice,
} from "@/lib/supabase-queries";
import { supabase } from "@/lib/supabase";
import { trackProductClick } from "@/lib/track-click";
import { useSEO } from "@/hooks/useSEO";
import { getDiscoveryContext } from "@/lib/discovery-context";
import { stripHtml, truncateToMeta } from "@/lib/brand-utils";
import fallbackImage from "@/assets/fallback-product.png";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [currentImage, setCurrentImage] = useState(0);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => getProduct(slug!),
    enabled: !!slug,
  });

  const { data: images = [] } = useQuery({
    queryKey: ["product-images", product?.id],
    queryFn: () => getProductImages(product!.id),
    enabled: !!product?.id,
  });

  const { data: specifications = [] } = useQuery({
    queryKey: ["product-specifications", product?.id],
    queryFn: () => getProductSpecifications(product!.id),
    enabled: !!product?.id,
  });

  const { data: productKeywords = [] } = useQuery({
    queryKey: ["product-keywords", product?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_keywords")
        .select("keyword_id, keywords(term)")
        .eq("product_id", product!.id);
      return (data || []).map((k: any) => k.keywords?.term).filter(Boolean) as string[];
    },
    enabled: !!product?.id,
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ["related-products", product?.id],
    queryFn: async () => {
      if (!product) return [];
      const ctx = getDiscoveryContext();
      let query = supabase
        .from("products")
        .select("id, slug, category, vibe_category")
        .eq("is_active", true)
        .neq("id", product.id)
        .limit(100);

      if (ctx?.type === "category" && ctx.name) {
        query = query.ilike("category", `%${ctx.name}%`);
      } else if (ctx?.type === "vibe" && ctx.name) {
        query = query.ilike("vibe_category", `%${ctx.name}%`);
      } else if (ctx?.type === "mood" && ctx.name) {
        query = query.ilike("mood", `%${ctx.name}%`);
      } else {
        query = query.order("date_added", { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!product?.id,
    staleTime: 1000 * 60 * 10,
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
    staleTime: 1000 * 60 * 10,
  });

  const categorySlugMap = Object.fromEntries(allCategories.map((c) => [c.name, { slug: c.slug, type: c.type }]));

  const primaryCategory = product?.category?.split(",")[0]?.trim() || "";
  const primaryVibe = product?.vibe_category?.split(",")[0]?.trim() || "";
  const seoTitle = product ? `${product.name} | ${primaryCategory || "Curated Pick"} | Mood & Vibes` : "Mood & Vibes";
  const seoDescription = product
    ? product.description
      ? truncateToMeta(stripHtml(product.description), 155)
      : truncateToMeta(
          `"${product.name}" is a curated ${primaryCategory || "lifestyle"} pick${
            primaryVibe ? ` for ${primaryVibe} vibes` : ""
          }.${productKeywords.length > 0 ? ` ${productKeywords.slice(0, 3).join(", ")}.` : ""}`,
          155,
        )
    : undefined;

  useSEO({
    title: seoTitle,
    rawTitle: true,
    description: seoDescription,
    image: product?.image_url || undefined,
    url: product ? `${window.location.origin}/product/${(product as any).slug || product.id}` : undefined,
    keywords: productKeywords.length > 0 ? productKeywords : undefined,
    productName: product?.name, // 👈 add this
    price: product?.price ?? null, // 👈 add this
  });

  // Images only (no video in gallery)
  const allImages = product
    ? [...(product.image_url ? [product.image_url] : []), ...images.map((img) => img.image_url)]
    : [];

  const handleAnother = () => {
    if (!product) return;
    // Get all categories and vibes for this product
    const cats = product.category
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const vibes =
      product.vibe_category
        ?.split(",")
        .map((v) => v.trim())
        .filter(Boolean) || [];

    // Filter to products sharing at least one category or vibe
    const related = allProducts.filter((p) => {
      if (p.id === product.id) return false;
      const pCats = p.category.split(",").map((c) => c.trim());
      const pVibes = p.vibe_category?.split(",").map((v) => v.trim()) || [];
      return cats.some((c) => pCats.includes(c)) || vibes.some((v) => pVibes.includes(v));
    });

    const pool = related.length > 0 ? related : allProducts;
    const next = getRandomProduct(pool, product.id);
    if (next) navigate(`/product/${(next as any).slug || next.id}`);
  };

  const handleBuyClick = () => {
    if (product) {
      trackProductClick(product.id);
      // Fire async click-time validation (non-blocking)
      supabase.functions
        .invoke("validate-click", {
          body: { product_id: product.id },
        })
        .catch(() => {});
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading product">
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
                    sizes="(min-width: 768px) 50vw, 100vw"
                    alt={product.name}
                    className="sharp-image h-full w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = fallbackImage;
                    }}
                  />
                  {allImages.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentImage((i) => (i - 1 + allImages.length) % allImages.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-card/80 p-1.5 backdrop-blur-sm transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => setCurrentImage((i) => (i + 1) % allImages.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-card/80 p-1.5 backdrop-blur-sm transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        aria-label="Next image"
                      >
                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-6xl text-muted-foreground">🛍️</div>
              )}
            </div>
            {/* Thumbnail strip */}
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {allImages.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImage(i)}
                    aria-label={`View image ${i + 1} of ${allImages.length}`}
                    aria-current={i === currentImage ? "true" : undefined}
                    className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                      i === currentImage ? "border-primary" : "border-transparent"
                    }`}
                  >
                    <img
                      src={url}
                      alt={`${product.name} ${i + 1}`}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = fallbackImage;
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="flex flex-col justify-center gap-4 p-8 md:w-1/2">
            <div className="flex flex-wrap gap-2">
              {[
                ...new Set(
                  product.category
                    .split(",")
                    .map((c) => c.trim())
                    .filter(Boolean),
                ),
              ].map((trimmed) => {
                const cat = categorySlugMap[trimmed];
                const to = cat ? (cat.type === "vibe" ? `/vibes/${cat.slug}` : `/category/${cat.slug}`) : "#";
                return (
                  <Link key={trimmed} to={to}>
                    <Badge className="cursor-pointer hover:bg-primary/80">{trimmed}</Badge>
                  </Link>
                );
              })}
              {product.vibe_category &&
                [
                  ...new Set(
                    product.vibe_category
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  ),
                ].map((trimmed) => {
                  const cat = categorySlugMap[trimmed];
                  const to = cat ? `/vibes/${cat.slug}` : "#";
                  return (
                    <Link key={`vibe-${trimmed}`} to={to}>
                      <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                        {trimmed}
                      </Badge>
                    </Link>
                  );
                })}
              {product.mood &&
                [
                  ...new Set(
                    product.mood
                      .split(",")
                      .map((m) => m.trim())
                      .filter(Boolean),
                  ),
                ].map((trimmed) => {
                  const cat = categorySlugMap[trimmed];
                  const to = cat ? `/moods/${cat.slug}` : "#";
                  return (
                    <Link key={`mood-${trimmed}`} to={to}>
                      <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                        {trimmed}
                      </Badge>
                    </Link>
                  );
                })}
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">{product.name}</h1>
            {product.company_name && <p className="text-sm text-muted-foreground">by {product.company_name}</p>}
            <div>
              <span className="font-heading text-3xl font-bold text-primary">{formatPrice(product.price)}</span>
              <p className="text-xs text-muted-foreground">
                {product.price_below_msrp ? "Seller often offers deals below MSRP" : "Price at retailer may vary"}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <ExternalCTA href={product.affiliate_url} label="Discover Brand" onClick={handleBuyClick} size="lg" />
              <ShareButton product={product} variant="full" />
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
            <p className="text-xs italic text-muted-foreground pt-1">
              More colors &amp; styles may be available on the seller's site
            </p>
            <ReportBrokenLink productId={product.id} variant="full" />
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
                <div key={spec.id} className={`flex ${i % 2 === 0 ? "bg-muted/50" : "bg-background"}`}>
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
