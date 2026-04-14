import { useState } from "react";
import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
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

interface ProductDrawerProps {
  product: Product;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function GalleryImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="w-full aspect-[4/5] bg-[#f5f5f5] flex items-center justify-center">
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

export default function ProductDrawer({ product, open, onOpenChange }: ProductDrawerProps) {
  const proxiedImage = useProxiedImage(product.image_url);
  const [currentIndex, setCurrentIndex] = useState(0);

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

  // Build gallery: hero image + extra images
  const allImages: { src: string; alt: string }[] = [];
  if (proxiedImage) allImages.push({ src: proxiedImage, alt: product.name });
  extraImages.forEach((img) => allImages.push({ src: img.image_url, alt: "" }));

  const safeIndex = Math.min(currentIndex, Math.max(0, allImages.length - 1));

  const goNext = () => setCurrentIndex((i) => Math.min(i + 1, allImages.length - 1));
  const goPrev = () => setCurrentIndex((i) => Math.max(i - 1, 0));

  // Reset index when product changes
  const [lastProductId, setLastProductId] = useState(product.id);
  if (product.id !== lastProductId) {
    setLastProductId(product.id);
    setCurrentIndex(0);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[40vw] sm:max-w-none p-0 border-l border-border">
        <ScrollArea className="h-full">
          <div className="flex flex-col">
            {/* Video */}
            {product.video_url && (
              <video
                src={product.video_url}
                autoPlay
                muted
                loop
                playsInline
                className="w-full aspect-video object-contain bg-[#f5f5f5]"
              />
            )}

            {/* Image gallery */}
            {allImages.length > 0 && (
              <div className="relative">
                <GalleryImage
                  src={allImages[safeIndex].src}
                  alt={allImages[safeIndex].alt}
                />

                {/* Navigation arrows */}
                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); goPrev(); }}
                      disabled={safeIndex === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 backdrop-blur-sm border border-border transition-opacity disabled:opacity-0 hover:bg-background"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); goNext(); }}
                      disabled={safeIndex === allImages.length - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 backdrop-blur-sm border border-border transition-opacity disabled:opacity-0 hover:bg-background"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>

                    {/* Dots */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {allImages.map((_, i) => (
                        <button
                          key={i}
                          onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
                          className={`h-1.5 rounded-full transition-all ${i === safeIndex ? "w-4 bg-foreground" : "w-1.5 bg-foreground/30"}`}
                          aria-label={`Go to image ${i + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Thumbnail strip */}
                {allImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto p-3">
                    {allImages.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentIndex(i)}
                        className={`h-16 w-16 flex-shrink-0 rounded-sm border overflow-hidden bg-[#f5f5f5] transition-all ${i === safeIndex ? "border-foreground ring-1 ring-foreground" : "border-border opacity-60 hover:opacity-100"}`}
                      >
                        <img src={img.src} alt="" className="h-full w-full object-contain" />
                      </button>
                    ))}
                  </div>
                )}
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
