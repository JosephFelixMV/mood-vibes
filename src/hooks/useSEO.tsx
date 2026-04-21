import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  keywords?: string[];
  rawTitle?: boolean;
  price?: number | null;
  productName?: string;
  ogType?: "website" | "product";
  collectionName?: string;
}

const SITE_DEFAULT_OG = "https://www.mood-and-vibes.com/og-default.jpg";

export function useSEO({ title, description, image, url, keywords, rawTitle, price, productName, ogType = "website", collectionName }: SEOProps) {
  useEffect(() => {
    if (!title && !description) return;

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

    const setLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        document.head.appendChild(el);
      }
      el.setAttribute("href", href);
    };

    const canonicalUrl = url || (window.location.origin + window.location.pathname);
    const ogImage = image || SITE_DEFAULT_OG;
    setLink("canonical", canonicalUrl);

    if (description) {
      setMeta("name", "description", description);
      setMeta("property", "og:description", description);
      setMeta("name", "twitter:description", description);
    }
    if (title) {
      setMeta("property", "og:title", fullTitle);
      setMeta("name", "twitter:title", fullTitle);
    }
    setMeta("property", "og:image", ogImage);
    setMeta("name", "twitter:image", ogImage);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:type", ogType);

    if (keywords && keywords.length > 0) {
      setMeta("name", "keywords", keywords.join(", "));
    }

    document.getElementById("seo-product-jsonld")?.remove();
    document.getElementById("seo-collection-jsonld")?.remove();

    if (productName) {
      const schema: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: productName,
        ...(description && { description }),
        image: ogImage,
        ...(keywords && keywords.length > 0 && { keywords: keywords.join(", ") }),
        ...(canonicalUrl && {
          offers: {
            "@type": "Offer",
            priceCurrency: "USD",
            ...(price != null && { price: price.toFixed(2) }),
            availability: "https://schema.org/InStock",
            url: canonicalUrl,
          },
        }),
      };
      const script = document.createElement("script");
      script.id = "seo-product-jsonld";
      script.type = "application/ld+json";
      script.text = JSON.stringify(schema);
      document.head.appendChild(script);
    }

    if (collectionName) {
      const schema: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: collectionName,
        ...(description && { description }),
        url: canonicalUrl,
        image: ogImage,
      };
      const script = document.createElement("script");
      script.id = "seo-collection-jsonld";
      script.type = "application/ld+json";
      script.text = JSON.stringify(schema);
      document.head.appendChild(script);
    }

    return () => {
      document.getElementById("seo-product-jsonld")?.remove();
      document.getElementById("seo-collection-jsonld")?.remove();
    };
  }, [title, description, image, url, keywords, rawTitle, price, productName, ogType, collectionName]);
}
