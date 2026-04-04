import { useEffect, useState, MutableRefObject } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getProduct, getCategories } from "@/lib/supabase-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RichTextEditor from "@/components/RichTextEditor";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Upload, Download } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { toast } from "sonner";
import type { Product } from "@/lib/supabase-queries";
import { formatPrice } from "@/lib/supabase-queries";

interface Props {
  editId: string | null;
  onDone: () => void;
  savedState?: MutableRefObject<Record<string, any> | null>;
}

interface SpecRow {
  item_detail: string;
  specification: string;
}

const empty = {
  name: "",
  description: "",
  price: "" as string | number,
  image_url: "",
  affiliate_url: "",
  source_url: "",
  category: "",
  vibe_category: "",
  company_name: "",
  video_url: "",
  is_active: true,
  additional_images: [] as string[],
  specifications: [] as SpecRow[],
};

export default function ProductForm({ editId, onDone, savedState }: Props) {
  const qc = useQueryClient();
  const { data: coreCategories = [] } = useQuery({
    queryKey: ["categories", "core"],
    queryFn: () => getCategories("core"),
  });
  const { data: vibeCategories = [] } = useQuery({
    queryKey: ["categories", "vibe"],
    queryFn: () => getCategories("vibe"),
  });
  const { data: existing } = useQuery({
    queryKey: ["product", editId],
    queryFn: () => getProduct(editId!),
    enabled: !!editId,
  });

  const [form, setForm] = useState(() => savedState?.current || empty);

  useEffect(() => {
    if (savedState) {
      savedState.current = form;
    }
  }, [form, savedState]);

  useEffect(() => {
    if (existing && editId) {
      // Load existing images and specifications
      Promise.all([
        supabase
          .from("product_images")
          .select("image_url")
          .eq("product_id", editId)
          .order("display_order"),
        supabase
          .from("product_specifications")
          .select("item_detail, specification")
          .eq("product_id", editId)
          .order("display_order"),
      ]).then(([imgRes, specRes]) => {
        setForm({
          name: existing.name,
          description: existing.description || "",
          price: existing.price,
          image_url: existing.image_url || "",
          affiliate_url: existing.affiliate_url,
          source_url: existing.source_url || "",
          category: existing.category,
          vibe_category: existing.vibe_category || "",
          company_name: existing.company_name || "",
          video_url: existing.video_url || "",
          is_active: existing.is_active,
          additional_images: imgRes.data?.map((d) => d.image_url) || [],
          specifications: specRes.data?.map((s) => ({
            item_detail: s.item_detail,
            specification: s.specification,
          })) || [],
        });
      });
    } else if (!editId && !savedState?.current) {
      setForm(empty);
    }
  }, [existing, editId]);

  const set = (key: string, val: any) => setForm((f: any) => ({ ...f, [key]: val }));

  const [suggestingCategories, setSuggestingCategories] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{ core: string[]; vibes: string[] } | null>(null);

  const suggestCategories = async (productName: string, description: string, price: string | number) => {
    setSuggestingCategories(true);
    setAiSuggestions(null);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-categories", {
        body: { name: productName, description, price },
      });
      if (error) throw error;
      console.log("AI category suggestions:", data);
      if (data?.core?.length || data?.vibes?.length) {
        const suggestions = {
          core: data.core || [],
          vibes: data.vibes || [],
        };
        setAiSuggestions(suggestions);
        setForm((prev: any) => ({
          ...prev,
          category: suggestions.core.length ? suggestions.core.join(",") : prev.category,
          vibe_category: suggestions.vibes.length ? suggestions.vibes.join(",") : prev.vibe_category,
        }));
        toast.success(`Suggested ${suggestions.core.length} categories and ${suggestions.vibes.length} vibes`);
      } else {
        toast.info("No category suggestions returned");
      }
    } catch (err) {
      console.error("Category suggestion failed:", err);
      toast.error("Category suggestion failed");
    } finally {
      setSuggestingCategories(false);
    }
  };

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const parsedPrice = typeof data.price === "string" ? parseFloat(data.price.replace(/[^0-9.]/g, "")) || "" : (data.price || "");
        setForm((prev: any) => ({
          ...prev,
          name: data.name || prev.name,
          company_name: data.company_name || prev.company_name,
          affiliate_url: data.affiliate_url || prev.affiliate_url,
          source_url: data.source_url || prev.source_url,
          image_url: data.image_url || prev.image_url,
          additional_images: Array.isArray(data.additional_images) && data.additional_images.length > 0
            ? data.additional_images.slice(0, 4)
            : prev.additional_images,
          video_url: data.video_url || prev.video_url,
          price: parsedPrice,
          description: data.description || prev.description,
          category: data.category || prev.category,
          vibe_category: data.vibe_category || prev.vibe_category,
          specifications: Array.isArray(data.specifications) && data.specifications.length > 0
            ? data.specifications
            : prev.specifications,
          is_active: typeof data.is_active === "boolean" ? data.is_active : prev.is_active,
        }));
        toast.success("Template loaded — suggesting categories...");
        // Auto-suggest categories based on product details
        const productName = data.name || "";
        const desc = data.description || "";
        if (productName) {
          suggestCategories(productName, desc, parsedPrice);
        }
      } catch {
        toast.error("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const a = document.createElement("a");
    a.href = "/product-template.json";
    a.download = "product-template.json";
    a.click();
  };

  const addImageField = () => {
    if (form.additional_images.length < 4) {
      set("additional_images", [...form.additional_images, ""]);
    }
  };

  const updateImage = (index: number, value: string) => {
    const updated = [...form.additional_images];
    updated[index] = value;
    set("additional_images", updated);
  };

  const removeImage = (index: number) => {
    set("additional_images", form.additional_images.filter((_: any, i: number) => i !== index));
  };

  // Specifications helpers
  const addSpecRow = () => {
    set("specifications", [...form.specifications, { item_detail: "", specification: "" }]);
  };

  const updateSpec = (index: number, field: keyof SpecRow, value: string) => {
    const updated = [...form.specifications];
    updated[index] = { ...updated[index], [field]: value };
    set("specifications", updated);
  };

  const removeSpec = (index: number) => {
    set("specifications", form.specifications.filter((_: any, i: number) => i !== index));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      // Duplicate check by name (includes drafts)
      if (!editId) {
        const { data: dupes } = await supabase
          .from("products")
          .select("id, is_active")
          .ilike("name", form.name.trim())
          .limit(1);
        if (dupes && dupes.length > 0) {
          const isDraft = !dupes[0].is_active;
          throw new Error(
            isDraft
              ? `A draft product named "${form.name.trim()}" already exists. Review existing drafts before adding a new one.`
              : `A product named "${form.name.trim()}" already exists.`
          );
        }
      }

      const payload = {
        name: form.name,
        description: form.description,
        price: Number(form.price) || 0,
        image_url: form.image_url,
        affiliate_url: form.affiliate_url,
        source_url: form.source_url,
        category: form.category,
        company_name: form.company_name,
        is_active: form.is_active,
        vibe_category: form.vibe_category || null,
        video_url: form.video_url || null,
      };

      let productId = editId;

      if (editId) {
        const { error } = await supabase.from("products").update(payload).eq("id", editId);
        if (error) throw error;
        await Promise.all([
          supabase.from("product_images").delete().eq("product_id", editId),
          supabase.from("product_specifications").delete().eq("product_id", editId),
        ]);
      } else {
        const { data, error } = await supabase.from("products").insert([payload]).select("id").single();
        if (error) throw error;
        productId = data.id;
      }

      const validImages = form.additional_images.filter((url: string) => url.trim());
      if (validImages.length > 0 && productId) {
        const { error } = await supabase.from("product_images").insert(
          validImages.map((url: string, i: number) => ({
            product_id: productId!,
            image_url: url.trim(),
            display_order: i + 1,
          }))
        );
        if (error) throw error;
      }

      const validSpecs = form.specifications.filter(
        (s: SpecRow) => s.item_detail.trim() && s.specification.trim()
      );
      if (validSpecs.length > 0 && productId) {
        const { error } = await supabase.from("product_specifications").insert(
          validSpecs.map((s: SpecRow, i: number) => ({
            product_id: productId!,
            item_detail: s.item_detail.trim(),
            specification: s.specification.trim(),
            display_order: i + 1,
          }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(editId ? "Product updated" : "Product added");
      if (!editId) {
        setForm(empty);
        if (savedState) savedState.current = null;
      }
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  const preview: Product = {
    id: "preview",
    name: form.name || "Product Name",
    description: form.description || "Product description will appear here",
    price: Number(form.price) || 0,
    image_url: form.image_url || null,
    affiliate_url: form.affiliate_url || "#",
    source_url: form.source_url || "",
    category: form.category || "Category",
    vibe_category: form.vibe_category || null,
    company_name: form.company_name || null,
    is_active: form.is_active,
    video_url: form.video_url || null,
    page_error: false,
    page_error_detail: null,
    date_added: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        {/* Template upload/download */}
        <div className="flex items-center gap-2 pb-2 border-b border-border mb-2">
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Download Template
          </Button>
          <label>
            <input type="file" accept=".json" onChange={handleTemplateUpload} className="hidden" />
            <Button type="button" variant="outline" size="sm" className="gap-1.5 cursor-pointer" asChild>
              <span><Upload className="h-3.5 w-3.5" /> Upload Template</span>
            </Button>
          </label>
        </div>
        <div>
          <Label>Product Name</Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div>
          <Label>Company Name</Label>
          <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
        </div>
        <div>
          <Label>Affiliate Link</Label>
          <Input value={form.affiliate_url} onChange={(e) => set("affiliate_url", e.target.value)} required placeholder="https://..." />
        </div>
        <div>
          <Label>Source Product Page URL (required, admin only)</Label>
          <Input value={form.source_url} onChange={(e) => set("source_url", e.target.value)} required placeholder="https://retailer.com/product/..." />
          <p className="mt-1 text-xs text-muted-foreground">Original product page URL for link validation</p>
        </div>
        <div>
          <Label>Main Image URL</Label>
          <Input value={form.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="https://..." />
        </div>

        {/* Manual Suggest Categories Button */}
        <Button
          type="button"
          variant="outline"
          disabled={suggestingCategories || !form.name}
          onClick={() => suggestCategories(form.name, form.description || "", form.price)}
          className="w-full"
        >
          {suggestingCategories ? (
            <span className="animate-pulse">✨ Analyzing...</span>
          ) : (
            <>✨ Suggest Categories</>
          )}
        </Button>

        {/* AI Category Suggestions Display */}
        {(suggestingCategories || aiSuggestions) && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              ✨ AI Category Suggestions
              {suggestingCategories && <span className="text-xs text-muted-foreground animate-pulse">analyzing...</span>}
            </p>
            {aiSuggestions && (
              <>
                {aiSuggestions.core.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Core Categories:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {aiSuggestions.core.map((c) => (
                        <span key={c} className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {aiSuggestions.vibes.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Vibes:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {aiSuggestions.vibes.map((v) => (
                        <span key={v} className="inline-flex items-center rounded-full bg-accent/50 px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">These categories have been auto-selected below. Adjust as needed.</p>
              </>
            )}
          </div>
        )}

        {/* Additional images */}
        <div>
          <div className="flex items-center justify-between">
            <Label>Additional Images ({form.additional_images.length}/4)</Label>
            <Button type="button" variant="outline" size="sm" onClick={addImageField} disabled={form.additional_images.length >= 4}>
              + Add Image
            </Button>
          </div>
          <div className="mt-2 space-y-2">
            {form.additional_images.map((url: string, i: number) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => updateImage(i, e.target.value)}
                  placeholder="https://..."
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeImage(i)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Video URL - after images */}
        <div>
          <Label>Video URL (optional)</Label>
          <Input value={form.video_url} onChange={(e) => set("video_url", e.target.value)} placeholder="https://..." />
          <p className="mt-1 text-xs text-muted-foreground">Direct link to an MP4 video file</p>
        </div>

        <div>
          <Label>Price</Label>
          <Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} required placeholder="29.99" />
        </div>
        <div>
          <Label>Description</Label>
          <RichTextEditor value={form.description} onChange={(html) => set("description", html)} />
        </div>
        <div>
          <Label>Category (Core Lifestyle — up to 3) {suggestingCategories && <span className="text-xs text-muted-foreground animate-pulse ml-2">✨ AI suggesting...</span>}</Label>
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border p-3 max-h-48 overflow-y-auto">
            {coreCategories.filter((c) => !!c.parent_slug).map((c) => {
              const selected = (form.category || "").split(",").filter(Boolean);
              const isChecked = selected.includes(c.name);
              const atLimit = selected.length >= 3 && !isChecked;
              return (
                <label key={c.id} className={`flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 ${atLimit ? "opacity-50 cursor-not-allowed" : ""}`}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={atLimit}
                    onChange={() => {
                      const updated = isChecked
                        ? selected.filter((v: string) => v !== c.name)
                        : [...selected, c.name];
                      set("category", updated.join(","));
                    }}
                    className="rounded"
                  />
                  {c.icon} {c.name}
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <Label>Vibes (Optional — select multiple)</Label>
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border p-3 max-h-48 overflow-y-auto">
            {vibeCategories.map((c) => {
              const selected = (form.vibe_category || "").split(",").filter(Boolean);
              const isChecked = selected.includes(c.name);
              return (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      const updated = isChecked
                        ? selected.filter((v: string) => v !== c.name)
                        : [...selected, c.name];
                      set("vibe_category", updated.join(","));
                    }}
                    className="rounded"
                  />
                  {c.icon} {c.name}
                </label>
              );
            })}
          </div>
        </div>

        {/* Specifications */}
        <div>
          <div className="flex items-center justify-between">
            <Label>Specifications (optional)</Label>
            <Button type="button" variant="outline" size="sm" onClick={addSpecRow} className="gap-1">
              <Plus className="h-3 w-3" /> Add Spec
            </Button>
          </div>
          <div className="mt-2 space-y-2">
            {form.specifications.map((spec: SpecRow, i: number) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={spec.item_detail}
                  onChange={(e) => updateSpec(i, "item_detail", e.target.value)}
                  placeholder="Item Detail (e.g. Material)"
                  className="w-2/5"
                />
                <Input
                  value={spec.specification}
                  onChange={(e) => updateSpec(i, "specification", e.target.value)}
                  placeholder="Specification (e.g. 100% Cotton)"
                  className="w-3/5"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeSpec(i)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
          <Label>{form.is_active ? "Active" : "Draft"}</Label>
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={mutation.isPending} className="rounded-full">
            {editId ? "Update Product" : "Add Product"}
          </Button>
          {!editId && (
            <Button type="button" variant="outline" onClick={() => { setForm(empty); if (savedState) savedState.current = null; }} className="rounded-full">
              Clear Fields
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onDone} className="rounded-full">Cancel</Button>
        </div>
      </form>

      {/* Live Preview */}
      <div>
        <p className="mb-3 text-sm font-medium text-muted-foreground">Live Preview</p>
        <ProductCard product={preview} />
      </div>
    </div>
  );
}
