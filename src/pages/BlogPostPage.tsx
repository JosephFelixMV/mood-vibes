import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getBlogPost, getBlogPostProducts } from "@/lib/supabase-queries";
import { useSEO } from "@/hooks/useSEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";
import { Info, ChevronLeft } from "lucide-react";

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

  useSEO({
    title: post?.title ?? "The Edit",
    description: post?.subtitle ?? undefined,
    image: post?.cover_image_url ?? undefined,
    url: slug ? `/blog/${slug}` : "/blog",
    breadcrumbs: post
      ? [
          { name: "The Edit", url: "/blog" },
          { name: post.title, url: `/blog/${post.slug}` },
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
          <Link to="/blog">
            <ChevronLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to The Edit
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <article className="container max-w-3xl py-12">
      {/* Back link */}
      <Link
        to="/blog"
        className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        The Edit
      </Link>

      {/* ── Region 1: Hero ── */}
      <header className="mb-10 space-y-4">
        {post.vibe_category && (
          <span
            className="inline-block rounded-full px-3 py-1 text-xs font-medium"
            style={{
              backgroundColor: "hsl(var(--badge-vibe))",
              color: "hsl(var(--badge-vibe-foreground))",
              border: "1px solid hsl(var(--badge-vibe-border))",
            }}
          >
            {post.vibe_category}
          </span>
        )}

        <h1 className="font-heading text-3xl font-bold leading-tight md:text-4xl">
          {post.title}
        </h1>

        {post.subtitle && (
          <p className="text-lg text-muted-foreground leading-relaxed">
            {post.subtitle}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{post.author}</span>
          {post.read_time && (
            <>
              <span aria-hidden>·</span>
              <span>{post.read_time}</span>
            </>
          )}
          {post.category && (
            <>
              <span aria-hidden>·</span>
              <span>{post.category}</span>
            </>
          )}
        </div>

        {post.has_affiliate_links && (
          <div className="flex gap-3 rounded-md border border-border bg-muted/60 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              This post contains affiliate links. If you click and make a
              purchase, Mood &amp; Vibes may earn a commission — at no extra
              cost to you.
            </p>
          </div>
        )}
      </header>

      {/* ── Region 2: Article Body ── */}
      {post.content && (
        <div
          className="blog-prose mb-12"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      )}

      {/* ── Region 3: Inline Product Grid ── */}
      {linkedProducts.length > 0 && (
        <section className="mb-12">
          <h2 className="font-heading text-xl font-semibold mb-6">
            Products Featured in This Post
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {linkedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* ── Region 4: CTA Block ── */}
      {post.cta_url && (
        <section className="mb-12 rounded-lg bg-primary px-8 py-10 text-center text-primary-foreground">
          <p className="font-heading text-2xl font-semibold mb-4">
            Ready to explore?
          </p>
          <Button asChild variant="secondary" size="lg" className="rounded-full font-medium">
            <Link to={post.cta_url}>{post.cta_label}</Link>
          </Button>
        </section>
      )}

      {/* ── Region 5: SEO Tag Footer ── */}
      {post.tags && post.tags.length > 0 && (
        <footer className="border-t border-border pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Tags:</span>
            {post.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </footer>
      )}
    </article>
  );
}
