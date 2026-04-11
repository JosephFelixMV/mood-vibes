import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Loader2, Layers, Sparkles, Upload, X, ImageIcon, Info, Heart } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Category } from "@/lib/supabase-queries";

interface CategoryForm {
  name: string;
  slug: string;
  icon: string;
  icon_url: string;
  description: string;
  parent_slug: string;
  type: "core" | "vibe" | "mood";
}

const emptyForm: CategoryForm = { name: "", slug: "", icon: "📦", icon_url: "", description: "", parent_slug: "", type: "core" };

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function CategoryVibeManager() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"core" | "vibe" | "mood">("core");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [originalName, setOriginalName] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  const coreCategories = categories.filter((c) => c.type === "core");
  const vibeCategories = categories.filter((c) => c.type === "vibe");
  const moodCategories = categories.filter((c) => c.type === "mood");
  const parents = coreCategories.filter((c) => !c.parent_slug);

  const handleIconUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("category-icons")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("category-icons")
        .getPublicUrl(fileName);

      setForm((p) => ({ ...p, icon_url: urlData.publicUrl }));
      toast.success("Icon uploaded");
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const saveMut = useMutation({
    mutationFn: async (data: CategoryForm & { id?: string; oldName?: string }) => {
      const newName = data.name.trim();
      const payload = {
        name: newName,
        slug: data.slug || slugify(data.name),
        icon: data.icon || "📦",
        icon_url: data.icon_url || null,
        description: data.description || null,
        parent_slug: data.type === "core" && data.parent_slug ? data.parent_slug : null,
        type: data.type,
      };
      if (data.id) {
        const { error } = await supabase.from("categories").update(payload).eq("id", data.id);
        if (error) throw error;

        // If name changed, update all products referencing the old name
        const oldName = data.oldName;
        if (oldName && oldName !== newName) {
          const column = data.type === "core" ? "category" : data.type === "vibe" ? "vibe_category" : "mood";
          // Fetch products containing the old name in the relevant column
          const { data: products } = await supabase
            .from("products")
            .select("id, category, vibe_category, mood")
            .ilike(column, `%${oldName}%`);

          if (products && products.length > 0) {
            for (const product of products) {
              const rawValue = column === "category" ? product.category : column === "vibe_category" ? product.vibe_category : product.mood;
              if (!rawValue) continue;
              const tags = rawValue.split(",").map((t: string) => t.trim());
              const updated = tags.map((t: string) => (t === oldName ? newName : t)).join(", ");
              if (updated !== rawValue) {
                const updatePayload = column === "category" ? { category: updated } : column === "vibe_category" ? { vibe_category: updated } : { mood: updated };
                await supabase.from("products").update(updatePayload).eq("id", product.id);
              }
            }
          }
        }
      } else {
        const { error } = await supabase.from("categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories-all"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(editingId ? "Category updated" : "Category added");
    },
    onError: (err: any) => toast.error("Failed: " + err.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories-all"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      setDeleteTarget(null);
      toast.success("Category deleted");
    },
    onError: (err: any) => toast.error("Failed: " + err.message),
  });

  const openAdd = (type: "core" | "vibe" | "mood") => {
    setEditingId(null);
    setForm({ ...emptyForm, type });
    setDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      icon_url: (cat as any).icon_url || "",
      description: cat.description || "",
      parent_slug: cat.parent_slug || "",
      type: cat.type as "core" | "vibe" | "mood",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return toast.error("Name is required");
    saveMut.mutate({ ...form, id: editingId || undefined });
  };

  const renderCategoryIcon = (cat: Category) => {
    const iconUrl = (cat as any).icon_url;
    if (iconUrl) {
      return <img src={iconUrl} alt={cat.name} className="h-6 w-6 rounded object-cover" />;
    }
    return <span className="text-xl">{cat.icon}</span>;
  };

  const renderCategoryRow = (cat: Category, indent = false) => (
    <div
      key={cat.id}
      className={`flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/30 ${indent ? "ml-8" : ""}`}
    >
      {renderCategoryIcon(cat)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{cat.name}</span>
          <Badge variant="outline" className="text-[10px] shrink-0">/{cat.slug}</Badge>
          {cat.parent_slug && (
            <Badge variant="secondary" className="text-[10px] shrink-0">sub</Badge>
          )}
        </div>
        {cat.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{cat.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(cat)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  const getTabLabel = () => {
    if (activeTab === "core") return "Category";
    if (activeTab === "vibe") return "Vibe";
    return "Mood";
  };

  if (isLoading) {
    return <div className="py-10 text-center text-muted-foreground">Loading categories…</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Layers className="h-5 w-5 text-primary" />
          Categories, Vibes & Moods
        </CardTitle>
        <CardDescription>Manage your product taxonomy — core categories, vibe collections, and mood tags.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "core" | "vibe" | "mood")}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="core" className="gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Categories ({coreCategories.length})
              </TabsTrigger>
              <TabsTrigger value="vibe" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Vibes ({vibeCategories.length})
              </TabsTrigger>
              <TabsTrigger value="mood" className="gap-1.5">
                <Heart className="h-3.5 w-3.5" /> Moods ({moodCategories.length})
              </TabsTrigger>
            </TabsList>
            <Button size="sm" className="gap-1.5" onClick={() => openAdd(activeTab)}>
              <Plus className="h-4 w-4" /> Add {getTabLabel()}
            </Button>
          </div>

          <TabsContent value="core" className="space-y-2 mt-0">
            {parents.map((parent) => {
              const children = coreCategories.filter((c) => c.parent_slug === parent.slug);
              return (
                <div key={parent.id} className="space-y-1.5">
                  {renderCategoryRow(parent)}
                  {children.map((child) => renderCategoryRow(child, true))}
                </div>
              );
            })}
            {coreCategories
              .filter((c) => c.parent_slug && !parents.find((p) => p.slug === c.parent_slug))
              .map((c) => renderCategoryRow(c))}
          </TabsContent>

          <TabsContent value="vibe" className="space-y-1.5 mt-0">
            {vibeCategories.map((v) => renderCategoryRow(v))}
          </TabsContent>

          <TabsContent value="mood" className="space-y-1.5 mt-0">
            {moodCategories.map((m) => renderCategoryRow(m))}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Add"} {form.type === "core" ? "Category" : form.type === "vibe" ? "Vibe" : "Mood"}</DialogTitle>
            <DialogDescription>
              {form.type === "core"
                ? "Core lifestyle categories organize products by function."
                : form.type === "vibe"
                  ? "Vibes are aesthetic collections that group products by style."
                  : "Moods describe the feeling or emotion a product evokes. Include anchor keywords in the description to help AI categorization."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Icon section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium">Icon</label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[220px]">
                      <p className="text-xs">Use an emoji or upload an image. Recommended: <strong>128×128px</strong> (square, PNG or SVG). Max 2MB.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex items-start gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Emoji</label>
                  <Input
                    value={form.icon}
                    onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
                    className="w-14 text-center text-lg"
                    maxLength={4}
                  />
                </div>

                <div className="text-xs text-muted-foreground pt-7">or</div>

                <div className="flex-1 space-y-1">
                  <label className="text-[11px] text-muted-foreground">Upload image</label>
                  {form.icon_url ? (
                    <div className="flex items-center gap-2">
                      <img src={form.icon_url} alt="Icon" className="h-10 w-10 rounded border object-cover" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setForm((p) => ({ ...p, icon_url: "" }))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 w-full"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {uploading ? "Uploading…" : "Choose file"}
                    </Button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleIconUpload(file);
                      e.target.value = "";
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">128×128px recommended · PNG or SVG · Max 2MB</p>
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Name *</label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    name: e.target.value,
                    slug: editingId ? p.slug : slugify(e.target.value),
                  }))
                }
                placeholder={form.type === "mood" ? "e.g. Cozy" : "e.g. Kitchen & Dining"}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Slug</label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                placeholder="auto-generated-from-name"
              />
              <p className="text-[11px] text-muted-foreground">URL path segment — auto-generated if left empty.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Description {form.type === "mood" && <span className="text-muted-foreground font-normal">(include anchor keywords for AI)</span>}
              </label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder={form.type === "mood"
                  ? "e.g. Warm, soft, comfort-seeking. Blankets, candles, slippers, mugs, loungewear"
                  : "Short description for landing pages…"}
                rows={form.type === "mood" ? 3 : 2}
              />
              {form.type === "mood" && (
                <p className="text-[11px] text-muted-foreground">
                  💡 Include product types and attributes as anchor keywords. These help the AI categorize products cheaply without extra API calls.
                </p>
              )}
            </div>
            {form.type === "core" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Parent Category (optional)</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.parent_slug}
                  onChange={(e) => setForm((p) => ({ ...p, parent_slug: e.target.value }))}
                >
                  <option value="">— None (top-level) —</option>
                  {parents
                    .filter((p) => p.id !== editingId)
                    .map((p) => (
                      <option key={p.id} value={p.slug}>
                        {p.icon} {p.name}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Nest under a parent to create a sub-category.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMut.isPending} className="gap-1.5">
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Save Changes" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the category from the system. Products already tagged with this category will keep their tags but will no longer appear on the landing page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
