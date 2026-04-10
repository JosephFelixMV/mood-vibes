import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, Plus, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const AVAILABLE_REGIONS = [
  { code: "US", label: "🇺🇸 United States" },
  { code: "CA", label: "🇨🇦 Canada" },
  { code: "Intl", label: "🌍 International" },
] as const;

interface Brand {
  id: string;
  name: string;
  affiliate_url: string;
  regions: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const emptyForm = {
  name: "",
  affiliate_url: "",
  regions: ["US"] as string[],
  is_active: true,
};

export default function BrandManager() {
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ["admin-brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Brand[];
    },
  });

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Brand name is required");
      if (!form.affiliate_url.trim()) throw new Error("Affiliate URL is required");

      const payload = {
        name: form.name.trim(),
        affiliate_url: form.affiliate_url.trim(),
        regions: form.regions.length > 0 ? form.regions : ["US"],
        is_active: form.is_active,
      };

      if (editId) {
        const { error } = await supabase.from("brands").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("brands").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      toast.success(editId ? "Brand updated" : "Brand added");
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("brands").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      toast.success("Brand deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(false);
  };

  const startEdit = (brand: Brand) => {
    setForm({
      name: brand.name,
      affiliate_url: brand.affiliate_url,
      regions: brand.regions || ["US"],
      is_active: brand.is_active,
    });
    setEditId(brand.id);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold">Brand Management</h2>
          <p className="text-sm text-muted-foreground">Manage affiliate brand links displayed on the Brands page</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="gap-1.5 rounded-full">
            <Plus className="h-4 w-4" /> Add Brand
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="rounded-xl border bg-card p-5 space-y-4"
        >
          <h3 className="font-heading text-lg font-semibold">
            {editId ? "Edit Brand" : "Add Brand"}
          </h3>
          <div>
            <Label>Brand / Website Name</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Amazon, Best Buy"
              required
            />
          </div>
          <div>
            <Label>Affiliate Link</Label>
            <Input
              value={form.affiliate_url}
              onChange={(e) => set("affiliate_url", e.target.value)}
              placeholder="https://..."
              required
            />
          </div>
          <div>
            <Label>Region Availability</Label>
            <div className="mt-2 flex flex-wrap gap-3 rounded-lg border p-3">
              {AVAILABLE_REGIONS.map((r) => {
                const checked = form.regions.includes(r.code);
                return (
                  <label key={r.code} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...form.regions, r.code]
                          : form.regions.filter((x) => x !== r.code);
                        set("regions", next.length > 0 ? next : ["US"]);
                      }}
                      className="rounded"
                    />
                    {r.label}
                  </label>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Select regions where this brand operates. Default: US only.</p>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
            <Label>{form.is_active ? "Active" : "Hidden"}</Label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saveMutation.isPending} className="rounded-full">
              {editId ? "Update Brand" : "Add Brand"}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm} className="rounded-full">
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : brands.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">No brands yet. Add one above.</p>
      ) : (
        <div className="divide-y rounded-xl border">
          {brands.map((brand) => (
            <div key={brand.id} className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{brand.name}</span>
                  {!brand.is_active && (
                    <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">Hidden</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <a
                    href={brand.affiliate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline truncate max-w-[300px] flex items-center gap-1"
                  >
                    {brand.affiliate_url} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
                <div className="flex gap-1 mt-1">
                  {(brand.regions || ["US"]).map((r) => (
                    <span key={r} className="text-[10px] rounded-full bg-muted px-2 py-0.5 font-medium">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => startEdit(brand)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm(`Delete "${brand.name}"?`)) {
                      deleteMutation.mutate(brand.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
