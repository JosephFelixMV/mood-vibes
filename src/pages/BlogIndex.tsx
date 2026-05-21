import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getBlogPosts } from "@/lib/supabase-queries";
import { useSEO } from "@/hooks/useSEO";
import { toStorageImage } from "@/lib/image-upload";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

export default function BlogIndex() {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["blog-posts"],
    queryFn: getBlogPosts,
    staleTime: 1000 * 60 * 5,
  });

  useSEO({
    title: "The Edit",
    description: "Stories, guides, and finds from the Mood & Vibes team.",
    breadcrumbs: [{ name: "The Edit", url: "/blogs" }],
  });

  return (
    <div className="container py-12">
      {/* Page header */}
      <header className="mb-10">
        <h1 className="font-heading text-4xl font-bold mb-3">The Edit</h1>
        <p className="text-muted-foreground text-lg">
          Stories, guides, and finds from the Mood &amp; Vibes team.
        </p>
      </header>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">
            Nothing here yet — check back soon for stories and guides.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link key={post.id} to={`/blogs/${post.slug}`} className="group block">
              <Card className="h-full overflow-hidden border-border transition-shadow hover:shadow-md">
                {post.cover_image_url && (
                  <div className="relative w-full overflow-hidden bg-[#f7f7f5]" style={{ paddingTop: "125%" }}>
                    <img
                      src={toStorageImage(post.cover_image_url, 800, 80)}
                      alt={post.title}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                )}
                <CardContent className="p-5 space-y-3">
                  {(post.vibe_category || post.category) && (
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: "hsl(var(--badge-vibe))",
                        color: "hsl(var(--badge-vibe-foreground))",
                        border: "1px solid hsl(var(--badge-vibe-border))",
                      }}
                    >
                      {[post.vibe_category, post.category].filter(Boolean).join(" | ")}
                    </span>
                  )}

                  <h2 className="font-heading text-xl font-semibold leading-snug group-hover:text-accent transition-colors">
                    {post.title}
                  </h2>

                  {post.subtitle && (
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                      {post.subtitle}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{post.author}</span>
                      {post.read_time && (
                        <>
                          <span aria-hidden>·</span>
                          <span>{post.read_time}</span>
                        </>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-accent">
                      Read Post
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
