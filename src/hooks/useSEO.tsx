import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  keywords?: string[];
  /** When true, use title exactly as passed without appending the brand suffix. */
  rawTitle?: boolean;
}

export function useSEO({ title, description, image, url, keywords, rawTitle }: SEOProps) {
  useEffect(() => {
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

    if (description) {
      setMeta("name", "description", description);
      setMeta("property", "og:description", description);
      setMeta("name", "twitter:description", description);
    }
    if (title) {
      setMeta("property", "og:title", `${title} | ${suffix}`);
      setMeta("name", "twitter:title", `${title} | ${suffix}`);
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
  }, [title, description, image, url, keywords]);
}
