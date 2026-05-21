import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/supabase-queries";

interface Props {
  html: string;
  inlineProducts: Product[];
}

const EMBED_RE = /<!--\s*product-embed:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*-->/gi;

const PROSE_CLASSES =
  "prose prose-lg max-w-none " +
  "prose-headings:font-heading " +
  "prose-h2:text-2xl prose-h2:font-semibold prose-h2:mt-12 prose-h2:mb-4 " +
  "prose-h3:text-xl prose-h3:font-semibold prose-h3:italic prose-h3:mt-8 prose-h3:mb-3 " +
  "prose-p:leading-relaxed " +
  "prose-strong:font-semibold " +
  "prose-a:text-accent prose-a:no-underline hover:prose-a:underline";

export default function BlogContentRenderer({ html, inlineProducts }: Props) {
  if (!html) return null;

  // Split html into alternating [htmlSegment, uuid, htmlSegment, uuid, ...]
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  EMBED_RE.lastIndex = 0;
  while ((match = EMBED_RE.exec(html)) !== null) {
    parts.push(html.slice(lastIndex, match.index)); // html before marker
    parts.push(match[1]);                            // uuid
    lastIndex = match.index + match[0].length;
  }
  parts.push(html.slice(lastIndex)); // remaining html after last marker

  const productMap = new Map(inlineProducts.map((p) => [p.id, p]));

  return (
    <div className="blog-content-body">
      {parts.map((part, i) => {
        if (i % 2 === 0) {
          // HTML segment
          if (!part.trim()) return null;
          return (
            <div
              key={i}
              className={PROSE_CLASSES}
              dangerouslySetInnerHTML={{ __html: part }}
            />
          );
        }
        // Product UUID
        const product = productMap.get(part);
        if (!product) return null;
        return (
          <div key={i} className="my-8 not-prose max-w-xs">
            <ProductCard product={product} />
          </div>
        );
      })}
    </div>
  );
}
