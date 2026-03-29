import { useEffect, useState, MutableRefObject } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getProduct, getCategories } from "@/lib/supabase-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { toast } from "sonner";
import type { Product } from "@/lib/supabase-queries";

interface Props {
  editId: string | null;
  onDone: () => void;
  savedState?: MutableRefObject<Record<string, any> | null>;
}

const empty = {
  name: "",
  description: "",
  price: "",
  image_url: "",
  affiliate_url: "",
  category: "",
  vibe_category: "",
  company_name: "",
  is_active: true,
  additional_images: [] as string[],
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

  // Save form state on every change
  useEffect(() => {
    if (savedState) {
      savedState.current = form;
    }
  }, [form, savedState]);

  useEffect(() => {
    if (existing && editId) {
      // Load existing images
      supabase
        .from("product_images")
        .select("image_url")
        .eq("product_id", editId)
        .order("display_order")
        .then(({ data }) => {
          setForm({
            name: existing.name,
            description: existing.description || "",
            price: existing.price,
            image_url: existing.image_url || "",
            affiliate_url: existing.affiliate_url,
            category: existing.category,
            vibe_category: existing.vibe_category || "",
            company_name: existing.company_name || "",
            is_active: existing.is_active,
            additional_images: data?.map((d) => d.image_url) || [],
          });
        });
    } else if (!editId && !savedState?.current) {
      setForm(empty);
    }
  }, [existing, editId]);

  const set = (key: string, val: string | boolean | string[]) => setForm((f) => ({ ...f, [key]: val }));

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
    set("additional_images", form.additional_images.filter((_, i) => i !== index));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const { additional_images, ...productData } = form;
      const payload = {
        ...productData,
        vibe_category: productData.vibe_category || null,
      };

      let productId = editId;

      if (editId) {
        const { error } = await supabase.from("products").update(payload).eq("id", editId);
        if (error) throw error;
        // Delete old additional images
        await supabase.from("product_images").delete().eq("product_id", editId);
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select("id").single();
        if (error) throw error;
        productId = data.id;
      }

      // Insert additional images
      const validImages = additional_images.filter((url) => url.trim());
      if (validImages.length > 0 && productId) {
        const { error } = await supabase.from("product_images").insert(
          validImages.map((url, i) => ({
            product_id: productId!,
            image_url: url.trim(),
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
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  const preview: Product = {
    id: "preview",
    name: form.name || "Product Name",
    description: form.description || "Product description will appear here",
    price: form.price || "$0.00",
    image_url: form.image_url || null,
    affiliate_url: form.affiliate_url || "#",
    category: form.category || "Category",
    vibe_category: form.vibe_category || null,
    company_name: form.company_name || null,
    is_active: form.is_active,
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
        <div>
          <Label>Product Name</Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div>
          <Label>Affiliate Link</Label>
          <Input value={form.affiliate_url} onChange={(e) => set("affiliate_url", e.target.value)} required placeholder="https://..." />
        </div>
        <div>
          <Label>Main Image URL</Label>
          <Input value={form.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="https://..." />
        </div>

        {/* Additional images */}
        <div>
          <div className="flex items-center justify-between">
            <Label>Additional Images ({form.additional_images.length}/4)</Label>
            <Button type="button" variant="outline" size="sm" onClick={addImageField} disabled={form.additional_images.length >= 4}>
              + Add Image
            </Button>
          </div>
          <div className="mt-2 space-y-2">
            {form.additional_images.map((url, i) => (
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

        <div>
          <Label>Price</Label>
          <Input value={form.price} onChange={(e) => set("price", e.target.value)} required placeholder="$29.99" />
        </div>
        <div>
          <Label>Short Description</Label>
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
        </div>
        <div>
          <Label>Category (Core Lifestyle)</Label>
          <Select value={form.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {coreCategories.map((c) => (
                <SelectItem key={c.id} value={c.name}>{c.icon} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Vibe (Optional)</Label>
          <Select value={form.vibe_category || "none"} onValueChange={(v) => set("vibe_category", v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select vibe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No vibe</SelectItem>
              {vibeCategories.map((c) => (
                <SelectItem key={c.id} value={c.name}>{c.icon} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Company Name</Label>
          <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
          <Label>{form.is_active ? "Active" : "Draft"}</Label>
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={mutation.isPending} className="rounded-full">
            {editId ? "Update Product" : "Add Product"}
          </Button>
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
