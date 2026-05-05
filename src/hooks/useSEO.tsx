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
  /** Inject WebSite JSON-LD with SearchAction — use on homepage only */
  siteSchema?: boolean;
  /** Breadcrumb trail: array of {name, url} items from root to current page */
  breadcrumbs?: { name: string; url: string }[];
  noindex?: boolean;
  canonicalOverride?: string;
}

const SITE_DEFAULT_OG = "https://www.mood-and-vibes.com/og-default.jpg";
const SITE_URL = "https://www.mood-and-vibes.com";

export function useSEO({
  title,
  description,
  image,
  url,
  keywords,
  rawTitle,
  price,
  productName,
  ogType = "website",
  collectionName,
  siteSchema,
  breadcrumbs,
  noindex,
  canonicalOverride,
}: SEOProps) {
  useEffect(() => {
    const setLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        document.head.appendChild(el);
      }
      el.setAttribute("href", href);
    };

    const canonicalUrl =
      canonicalOverride || url || window.location.origin + window.location.pathname;

    // Always update canonical and robots meta regardless of whether title/description
    // are ready — noindex must fire on thin combo pages even during the loading window.
    setLink("canonical", canonicalUrl);

    const existingRobots = document.querySelector('meta[name="robots"]');
    if (noindex) {
      if (existingRobots) {
        existingRobots.setAttribute("content", "noindex, follow");
      } else {
        const m = document.createElement("meta");
        m.setAttribute("name", "robots");
        m.setAttribute("content", "noindex, follow");
        document.head.appendChild(m);
      }
    } else if (existingRobots) {
      existingRobots.remove();
    }

    if (!title && !description) return;

    const suffix = "Mood & Vibes";
    const fullTitle = title
      ? rawTitle || title.includes(suffix)
        ? title
        : `${title} | ${suffix}`
      : suffix;
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

    const ogImage = image || SITE_DEFAULT_OG;

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

    // Clean up all JSON-LD on every render
    document.getElementById("seo-product-jsonld")?.remove();
    document.getElementById("seo-collection-jsonld")?.remove();
    document.getElementById("seo-website-jsonld")?.remove();
    document.getElementById("seo-breadcrumb-jsonld")?.remove();

    // Product schema
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

    // CollectionPage schema
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

    // WebSite schema with SearchAction — homepage only
    if (siteSchema) {
      const schema = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Mood & Vibes",
        url: SITE_URL,
        description: "Daily curated product picks organized by mood, vibe, and lifestyle.",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/products?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      };
      const script = document.createElement("script");
      script.id = "seo-website-jsonld";
      script.type = "application/ld+json";
      script.text = JSON.stringify(schema);
      document.head.appendChild(script);
    }

    // BreadcrumbList schema
    if (breadcrumbs && breadcrumbs.length > 0) {
      const schema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((crumb, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: crumb.name,
          item: crumb.url,
        })),
      };
      const script = document.createElement("script");
      script.id = "seo-breadcrumb-jsonld";
      script.type = "application/ld+json";
      script.text = JSON.stringify(schema);
      document.head.appendChild(script);
    }

    return () => {
      document.getElementById("seo-product-jsonld")?.remove();
      document.getElementById("seo-collection-jsonld")?.remove();
      document.getElementById("seo-website-jsonld")?.remove();
      document.getElementById("seo-breadcrumb-jsonld")?.remove();
    };
  }, [title, description, image, url, keywords, rawTitle, price, productName, ogType, collectionName, siteSchema, breadcrumbs, noindex, canonicalOverride]);
}
