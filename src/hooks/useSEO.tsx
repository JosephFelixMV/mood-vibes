import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  keywords?: string[];
  /** When true, use title exactly as passed without appending the brand suffix. */
  rawTitle?: boolean;
  /** Pass product price to enable JSON-LD Product schema (no brand, affiliate-safe) */
  price?: number | null;
  /** Pass product name separately for JSON-LD schema name field */
  productName?: string;
}

export function useSEO({ title, description, image, url, keywords, rawTitle, price, productName }: SEOProps) {
  useEffect(() => {
    const suffix = "Mood & Vibes";
    const fullTitle = title ? (rawTitle || title.includes(suffix) ? title : `${title} | ${suffix}`) : suffix;
    document.title = fullTitle;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    if (description) {
      setMeta("name", "description", description);
      setMeta("property", "og:description", description);
      setMeta("name", "twitter:description", description);
    }
    if (title) {
      setMeta("property", "og:title", fullTitle);
      setMeta("name", "twitter:title", fullTitle);
    }
    if (image) {
      setMeta("property", "og:image", image);
      setMeta("name", "twitter:image", image);
    }
    if (url) {
      setMeta("property", "og:url", url);
    }
    if (keywords && keywords.length > 0) {
      setMeta("name", "keywords", keywords.join(", "));
    }

    // JSON-LD Product schema — no brand field, affiliate-safe
    const existingSchema = document.getElementById("seo-product-jsonld");
    if (existingSchema) existingSchema.remove();

    if (productName) {
      const schema: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: productName,
        ...(description && { description }),
        ...(image && { image }),
        ...(keywords && keywords.length > 0 && { keywords: keywords.join(", ") }),
        ...(url && {
          offers: {
            "@type": "Offer",
            priceCurrency: "USD",
            ...(price != null && { price: price.toFixed(2) }),
            availability: "https://schema.org/InStock",
            url,
          },
        }),
      };

      const script = document.createElement("script");
      script.id = "seo-product-jsonld";
      script.type = "application/ld+json";
      script.text = JSON.stringify(schema);
      document.head.appendChild(script);
    }

    return () => {
      document.getElementById("seo-product-jsonld")?.remove();
    };
  }, [title, description, image, url, keywords, rawTitle, price, productName]);
}
