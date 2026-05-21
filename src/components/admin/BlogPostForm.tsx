import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getCategories, getAdminProducts } from "@/lib/supabase-queries";
import type { BlogPost, Product } from "@/lib/supabase-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, ExternalLink, Loader2 } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import { toast } from "sonner";

interface Props {
  editId: string | null;
  onClose: () => void;
}

const toSlug = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const emptyForm = {
  title: "",
  slug: "",
  subtitle: "",
  cover_image_url: "",
  vibe_category: "",
  category: "",
  content: "",
  cta_label: "Explore the Vibe",
  cta_url: "",
  tags: "",
  has_affiliate_links: true,
  is_active: false,
};

export default function BlogPostForm({ editId, onClose }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [linkedProductIds, setLinkedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");

  const { data: vibes = [] } = useQuery({
    queryKey: ["categories", "vibe"],
    queryFn: () => getCategories("vibe"),
    staleTime: 1000 * 60 * 2,
  });

  const { data: coreCategories = [] } = useQuery({
    queryKey: ["categories", "core"],
    queryFn: () => getCategories("core"),
    staleTime: 1000 * 60 * 2,
  });

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["admin-products-all"],
    queryFn: getAdminProducts,
    staleTime: 1000 * 60 * 5,
  });

  const { data: existingPost } = useQuery<BlogPost | null>({
    queryKey: ["blog-post-admin", editId],
    queryFn: async () => {
      if (!editId) return null;
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("id", editId)
        .single();
      if (error) throw error;
      return data as BlogPost;
    },
    enabled: !!editId,
    staleTime: 1000 * 60 * 2,
  });

  const { data: existingLinked = [] } = useQuery<string[]>({
    queryKey: ["blog-post-products-admin", editId],
    queryFn: async () => {
      if (!editId) return [];
      const { data, error } = await supabase
        .from("blog_post_products")
        .select("product_id, display_order")
        .eq("post_id", editId)
        .order("display_order");
      if (error) throw error;
      return (data || []).map((r: any) => r.product_id as string);
    },
    enabled: !!editId,
    staleTime: 1000 * 60 * 2,
  });

  useEffect(() => {
    if (existingPost) {
      setForm({
        title: existingPost.title,
        slug: existingPost.slug,
        subtitle: existingPost.subtitle ?? "",
        cover_image_url: existingPost.cover_image_url ?? "",
        vibe_category: existingPost.vibe_category ?? "",
        category: existingPost.category ?? "",
        content: existingPost.content ?? "",
        cta_label: existingPost.cta_label,
        cta_url: existingPost.cta_url ?? "",
        tags: existingPost.tags?.join(", ") ?? "",
        has_affiliate_links: existingPost.has_affiliate_links,
        is_active: existingPost.is_active,
      });
      setSlugManuallyEdited(true);
    }
  }, [existingPost]);

  useEffect(() => {
    if (existingLinked.length > 0) {
      setLinkedProductIds(existingLinked);
    }
  }, [existingLinked]);

  const handleTitleChange = (title: string) => {
    setForm((f) => ({
      ...f,
      title,
      slug: slugManuallyEdited ? f.slug : toSlug(title),
    }));
  };

  const handleSlugChange = (slug: string) => {
    setSlugManuallyEdited(true);
    setForm((f) => ({ ...f, slug }));
  };

  const wasActiveBefore = existingPost?.is_active ?? false;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title is required.");
      if (!form.slug.trim()) throw new Error("Slug is required.");

      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const publishedAt =
        form.is_active && !wasActiveBefore
          ? new Date().toISOString()
          : existingPost?.published_at ?? null;

      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        subtitle: form.subtitle.trim() || null,
        cover_image_url: form.cover_image_url.trim() || null,
        vibe_category: form.vibe_category || null,
        category: form.category || null,
        content: form.content || null,
        cta_label: form.cta_label.trim() || "Explore the Vibe",
        cta_url: form.cta_url.trim() || null,
        tags,
        has_affiliate_links: form.has_affiliate_links,
        is_active: form.is_active,
        published_at: publishedAt,
      };

      let postId: string;

      if (editId) {
        const { error } = await supabase
          .from("blog_posts")
          .update(payload)
          .eq("id", editId);
        if (error) throw error;
        postId = editId;
      } else {
        const { data, error } = await supabase
          .from("blog_posts")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        postId = data.id;
      }

      // Sync linked products: delete + re-insert
      const { error: delErr } = await supabase
        .from("blog_post_products")
        .delete()
        .eq("post_id", postId);
      if (delErr) throw delErr;

      if (linkedProductIds.length > 0) {
        const rows = linkedProductIds.map((product_id, idx) => ({
          post_id: postId,
          product_id,
          display_order: idx,
        }));
        const { error: insErr } = await supabase
          .from("blog_post_products")
          .insert(rows);
        if (insErr) throw insErr;
      }

      return postId;
    },
    onSuccess: (postId) => {
      qc.invalidateQueries({ queryKey: ["admin-blog-posts"] });
      qc.invalidateQueries({ queryKey: ["blog-posts"] });
      qc.invalidateQueries({ queryKey: ["blog-post-admin", editId] });
      qc.invalidateQueries({ queryKey: ["blog-post-products-admin", editId] });
      toast.success(editId ? "Post updated." : "Post created.");
      if (!editId) {
        // Redirect to edit so user can continue editing the new post
        onClose();
      }
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Save failed.");
    },
  });

  const toggleProduct = (id: string) => {
    setLinkedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const filteredProducts = allProducts.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.company_name ?? "").toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 30);

  const linkedProducts = linkedProductIds
    .map((id) => allProducts.find((p) => p.id === id))
    .filter(Boolean) as Product[];

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">
          {editId ? "Edit Post" : "New Post"}
        </h2>
        <div className="flex gap-2">
          {editId && form.slug && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/blogs/${form.slug}`, "_blank")}
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Preview
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Save
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Title */}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="bf-title">Title *</Label>
          <Input
            id="bf-title"
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Why Weighted Blankets Work"
          />
        </div>

        {/* Slug */}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="bf-slug">Slug *</Label>
          <Input
            id="bf-slug"
            value={form.slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="why-weighted-blankets-work"
            className="font-mono text-sm"
          />
        </div>

        {/* Subtitle */}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="bf-subtitle">Subtitle / Excerpt</Label>
          <Input
            id="bf-subtitle"
            value={form.subtitle}
            onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
            placeholder="Short description shown in post cards"
          />
        </div>

        {/* Cover Image URL */}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="bf-cover">Cover Image URL</Label>
          <Input
            id="bf-cover"
            value={form.cover_image_url}
            onChange={(e) => setForm((f) => ({ ...f, cover_image_url: e.target.value }))}
            placeholder="https://..."
          />
        </div>

        {/* Vibe Category */}
        <div className="space-y-1.5">
          <Label>Vibe Category</Label>
          <Select
            value={form.vibe_category || "none"}
            onValueChange={(v) => setForm((f) => ({ ...f, vibe_category: v === "none" ? "" : v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select vibe…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {vibes.map((v) => (
                <SelectItem key={v.slug} value={v.slug}>
                  {v.icon} {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Core Category */}
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select
            value={form.category || "none"}
            onValueChange={(v) => setForm((f) => ({ ...f, category: v === "none" ? "" : v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {coreCategories.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.icon} {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* CTA Label */}
        <div className="space-y-1.5">
          <Label htmlFor="bf-cta-label">CTA Label</Label>
          <Input
            id="bf-cta-label"
            value={form.cta_label}
            onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))}
            placeholder="Explore the Vibe"
          />
        </div>

        {/* CTA URL */}
        <div className="space-y-1.5">
          <Label htmlFor="bf-cta-url">CTA URL</Label>
          <Input
            id="bf-cta-url"
            value={form.cta_url}
            onChange={(e) => setForm((f) => ({ ...f, cta_url: e.target.value }))}
            placeholder="/vibes/homebody"
          />
        </div>

        {/* Tags */}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="bf-tags">Tags (comma-separated)</Label>
          <Input
            id="bf-tags"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder="weighted blanket, sleep, anxiety, sensory"
          />
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-3">
          <Switch
            id="bf-affiliate"
            checked={form.has_affiliate_links}
            onCheckedChange={(v) => setForm((f) => ({ ...f, has_affiliate_links: v }))}
          />
          <Label htmlFor="bf-affiliate">Has Affiliate Links</Label>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="bf-active"
            checked={form.is_active}
            onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
          />
          <Label htmlFor="bf-active">
            {form.is_active ? "Published" : "Draft"}
          </Label>
        </div>
      </div>

      {/* Content Editor */}
      <div className="space-y-1.5">
        <Label>Content</Label>
        <div className="rounded-md border border-input">
          <RichTextEditor
            value={form.content}
            onChange={(html) => setForm((f) => ({ ...f, content: html }))}
          />
        </div>
      </div>

      {/* Linked Products */}
      <div className="space-y-2">
        <Label>Linked Products</Label>
        {linkedProducts.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-1">
            {linkedProducts.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium"
              >
                {p.name}
                <button
                  type="button"
                  onClick={() => toggleProduct(p.id)}
                  className="ml-0.5 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <Input
          placeholder="Search products to link…"
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
        />
        {productSearch && (
          <div className="max-h-48 overflow-y-auto rounded-md border border-input bg-popover p-1 shadow-sm">
            {filteredProducts.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">No products found.</p>
            ) : (
              filteredProducts.map((p) => {
                const selected = linkedProductIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { toggleProduct(p.id); setProductSearch(""); }}
                    className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-left hover:bg-accent hover:text-accent-foreground ${selected ? "bg-secondary font-medium" : ""}`}
                  >
                    {selected && <span className="text-accent">✓</span>}
                    <span>{p.name}</span>
                    {p.company_name && (
                      <span className="text-muted-foreground">· {p.company_name}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
