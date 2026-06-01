import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/supabase-queries";

interface Props {
  html: string;
  inlineProducts: Product[];
}

// TipTap strips HTML comments, so markers are stored as plain text inside <p> tags.
// Format the author pastes: [product-embed: uuid] on its own line.
// TipTap serialises it as: <p>[product-embed: uuid]</p>
const EMBED_RE = /<p>\s*\[product-embed:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*\]\s*<\/p>/gi;

const PROSE_CLASSES =
  "prose prose-lg max-w-none " +
  "prose-headings:font-heading " +
  "prose-h2:text-2xl prose-h2:font-semibold prose-h2:mt-12 prose-h2:mb-4 " +
  "prose-h3:text-xl prose-h3:font-semibold prose-h3:italic prose-h3:mt-8 prose-h3:mb-3 " +
  "prose-p:leading-relaxed " +
  "prose-strong:font-semibold " +
  "prose-a:text-accent prose-a:no-underline hover:prose-a:underline";

type HtmlPart = { type: "html"; content: string };
type ProductPart = { type: "product"; id: string };
type GroupPart = { type: "product-group"; ids: string[] };
type Part = HtmlPart | ProductPart;
type GroupedPart = HtmlPart | GroupPart;

function parseContent(html: string): Part[] {
  const parts: Part[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  EMBED_RE.lastIndex = 0;
  while ((match = EMBED_RE.exec(html)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "html", content: html.slice(lastIndex, match.index) });
    }
    parts.push({ type: "product", id: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < html.length) {
    parts.push({ type: "html", content: html.slice(lastIndex) });
  }
  return parts;
}

function groupConsecutiveProducts(parts: Part[]): GroupedPart[] {
  const result: GroupedPart[] = [];
  let i = 0;
  while (i < parts.length) {
    if (parts[i].type === "product") {
      const ids: string[] = [];
      while (i < parts.length && parts[i].type === "product") {
        ids.push((parts[i] as ProductPart).id);
        i++;
      }
      result.push({ type: "product-group", ids });
    } else {
      result.push(parts[i] as HtmlPart);
      i++;
    }
  }
  return result;
}

export default function BlogContentRenderer({ html, inlineProducts }: Props) {
  if (!html) return null;

  const grouped = groupConsecutiveProducts(parseContent(html));
  const productMap = new Map(inlineProducts.map((p) => [p.id, p]));

  return (
    <div className="blog-content-body">
      {grouped.map((part, i) => {
        if (part.type === "html") {
          if (!part.content.trim()) return null;
          return (
            <div
              key={i}
              className={PROSE_CLASSES}
              dangerouslySetInnerHTML={{ __html: part.content }}
            />
          );
        }

        const products = part.ids
          .map((id) => productMap.get(id))
          .filter((p): p is Product => p !== undefined);

        if (products.length === 0) return null;

        if (products.length === 1) {
          return (
            <div key={i} className="not-prose my-8 max-w-sm mx-auto">
              <ProductCard product={products[0]} />
            </div>
          );
        }

        return (
          <div
            key={i}
            className="not-prose my-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
