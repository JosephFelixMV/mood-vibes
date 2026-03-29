import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getProduct, getCategories } from "@/lib/supabase-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProductCard from "@/components/ProductCard";
import { toast } from "sonner";
import type { Product } from "@/lib/supabase-queries";

interface Props {
  editId: string | null;
  onDone: () => void;
}

const empty = {
  name: "",
  description: "",
  price: "",
  image_url: "",
  affiliate_url: "",
  category: "",
  company_name: "",
  is_active: true,
};

export default function ProductForm({ editId, onDone }: Props) {
  const qc = useQueryClient();
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const { data: existing } = useQuery({
    queryKey: ["product", editId],
    queryFn: () => getProduct(editId!),
    enabled: !!editId,
  });

  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        description: existing.description || "",
        price: existing.price,
        image_url: existing.image_url || "",
        affiliate_url: existing.affiliate_url,
        category: existing.category,
        company_name: existing.company_name || "",
        is_active: existing.is_active,
      });
    } else if (!editId) {
      setForm(empty);
    }
  }, [existing, editId]);

  const set = (key: string, val: string | boolean) => setForm((f) => ({ ...f, [key]: val }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from("products").update(form).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(form);
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
          <Label>Image URL</Label>
          <Input value={form.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="https://..." />
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
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
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
          <Button type="submit" disabled={mutation.isPending}>
            {editId ? "Update Product" : "Add Product"}
          </Button>
          <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
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
