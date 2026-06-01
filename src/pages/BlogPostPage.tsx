import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getBlogPost, getBlogPostProducts, getBlogInlineProducts, getCategories } from "@/lib/supabase-queries";
import { useSEO } from "@/hooks/useSEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";
import BlogContentRenderer from "@/components/blog/BlogContentRenderer";
import { Info, ChevronLeft } from "lucide-react";
import { format } from "date-fns";

const VIBE_EMOJI: Record<string, string> = {
  homebody: "🛋️",
  "bloom-glow": "🌸",
  "pure-routine": "✨",
  "kitchen-flex": "🍳",
  "quiet-luxury": "🤍",
};

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading, isError } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: () => getBlogPost(slug!),
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
  });

  const { data: linkedProducts = [] } = useQuery({
    queryKey: ["blog-post-products", post?.id],
    queryFn: () => getBlogPostProducts(post!.id),
    enabled: !!post?.id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: inlineProducts = [] } = useQuery({
    queryKey: ["blog-inline-products", post?.id],
    queryFn: () => getBlogInlineProducts(post!.id),
    enabled: !!post?.id,
    staleTime: 1000 * 60 * 5,
  });

  useSEO({
    title: post?.title ?? "The Edit",
    description: post?.subtitle ?? undefined,
    image: post?.cover_image_url ?? undefined,
    url: slug ? `/blogs/${slug}` : "/blogs",
    breadcrumbs: post
      ? [
          { name: "The Edit", url: "/blogs" },
          { name: post.title, url: `/blogs/${post.slug}` },
        ]
      : undefined,
  });

  if (isLoading) {
    return (
      <div className="container py-16 text-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="container py-16 text-center">
        <p className="text-muted-foreground mb-4">Post not found.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/blogs">
            <ChevronLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to The Edit
          </Link>
        </Button>
      </div>
    );
  }

  const ctaEmoji = post.vibe_category
    ? (VIBE_EMOJI[post.vibe_category] ?? "✨")
    : "✨";

  const publishedDate =
    post.published_at && !isNaN(new Date(post.published_at).getTime())
      ? format(new Date(post.published_at), "MMMM d, yyyy")
      : null;

  return (
    <div>
      {/* ── Region 1: Hero ── */}
      <header className="border-b border-border bg-[#F7F2EC] py-12">
        <div className="container max-w-3xl space-y-5 text-center">
          {/* Back link */}
          <div className="flex justify-start">
            <Link
              to="/blogs"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              The Edit
            </Link>
          </div>

          {/* Vibe + Mood pills */}
          {(post.vibe_category || post.category) && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
              {[post.vibe_category, post.category].filter(Boolean).map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary"
                >
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/40" />
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="font-heading text-4xl font-bold leading-tight text-foreground md:text-5xl">
            {post.title}
          </h1>

          {/* Subtitle */}
          {post.subtitle && (
            <p className="text-lg leading-relaxed text-muted-foreground">
              {post.subtitle}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{post.author}</span>
            {post.read_time && (
              <>
                <span className="text-border" aria-hidden>·</span>
                <span>{post.read_time}</span>
              </>
            )}
            {publishedDate && (
              <>
                <span className="text-border" aria-hidden>·</span>
                <span>{publishedDate}</span>
              </>
            )}
          </div>

          {/* Affiliate disclosure */}
          {post.has_affiliate_links && (
            <div className="flex gap-3 rounded-md border border-border bg-card px-4 py-3 text-left">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                This post contains affiliate links. If you click and make a
                purchase, Mood &amp; Vibes may earn a commission — at no extra
                cost to you.
              </p>
            </div>
          )}
        </div>
      </header>

      {/* ── Region 2: Article Body ── */}
      {post.content && (
        <div className="blog-prose container max-w-3xl py-10 mb-4">
          <BlogContentRenderer html={post.content} inlineProducts={inlineProducts} />
        </div>
      )}

      {/* ── Region 3: Footer Product Grid ── */}
      {linkedProducts.length > 0 && (
        <section className="container max-w-3xl mb-12">
          <h2 className="font-heading text-xl font-semibold mb-4">
            Featured Products
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {linkedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* ── Region 4: CTA Block ── */}
      {post.cta_url && (
        <section className="container max-w-3xl mb-12">
          <div className="relative overflow-hidden rounded-xl bg-primary px-8 py-10 text-center text-primary-foreground">
            <span
              className="pointer-events-none absolute -right-4 -top-4 select-none text-[8rem] opacity-10"
              aria-hidden
            >
              {ctaEmoji}
            </span>
            <p className="font-heading text-2xl font-semibold mb-4 relative">
              Ready to explore?
            </p>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="relative rounded-full font-medium"
            >
              <Link to={post.cta_url}>{post.cta_label}</Link>
            </Button>
          </div>
        </section>
      )}

      {/* ── Region 5: SEO Tag Footer ── */}
      {post.tags && post.tags.length > 0 && (
        <footer className="container max-w-3xl mt-10 border-t border-border pt-6 pb-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Tags:</span>
            {post.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}
