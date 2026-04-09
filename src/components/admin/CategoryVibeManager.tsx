import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Loader2, Layers, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@/lib/supabase-queries";

interface CategoryForm {
  name: string;
  slug: string;
  icon: string;
  description: string;
  parent_slug: string;
  type: "core" | "vibe";
}

const emptyForm: CategoryForm = { name: "", slug: "", icon: "📦", description: "", parent_slug: "", type: "core" };

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function CategoryVibeManager() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"core" | "vibe">("core");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);

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
  const parents = coreCategories.filter((c) => !c.parent_slug);

  const saveMut = useMutation({
    mutationFn: async (data: CategoryForm & { id?: string }) => {
      const payload = {
        name: data.name.trim(),
        slug: data.slug || slugify(data.name),
        icon: data.icon || "📦",
        description: data.description || null,
        parent_slug: data.type === "core" && data.parent_slug ? data.parent_slug : null,
        type: data.type,
      };
      if (data.id) {
        const { error } = await supabase.from("categories").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories-all"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
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

  const openAdd = (type: "core" | "vibe") => {
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
      description: cat.description || "",
      parent_slug: cat.parent_slug || "",
      type: cat.type as "core" | "vibe",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return toast.error("Name is required");
    saveMut.mutate({ ...form, id: editingId || undefined });
  };

  const renderCategoryRow = (cat: Category, indent = false) => (
    <div
      key={cat.id}
      className={`flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/30 ${indent ? "ml-8" : ""}`}
    >
      <span className="text-xl">{cat.icon}</span>
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

  if (isLoading) {
    return <div className="py-10 text-center text-muted-foreground">Loading categories…</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Layers className="h-5 w-5 text-primary" />
          Categories & Vibes
        </CardTitle>
        <CardDescription>Manage your product taxonomy — core lifestyle categories and vibe collections.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "core" | "vibe")}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="core" className="gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Core Categories ({coreCategories.length})
              </TabsTrigger>
              <TabsTrigger value="vibe" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Vibes ({vibeCategories.length})
              </TabsTrigger>
            </TabsList>
            <Button size="sm" className="gap-1.5" onClick={() => openAdd(activeTab)}>
              <Plus className="h-4 w-4" /> Add {activeTab === "core" ? "Category" : "Vibe"}
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
            {/* Orphan subcategories (parent_slug set but parent not found) */}
            {coreCategories
              .filter((c) => c.parent_slug && !parents.find((p) => p.slug === c.parent_slug))
              .map((c) => renderCategoryRow(c))}
          </TabsContent>

          <TabsContent value="vibe" className="space-y-1.5 mt-0">
            {vibeCategories.map((v) => renderCategoryRow(v))}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Add"} {form.type === "core" ? "Category" : "Vibe"}</DialogTitle>
            <DialogDescription>
              {form.type === "core"
                ? "Core lifestyle categories organize products by function."
                : "Vibes are aesthetic collections that group products by mood."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[60px_1fr] gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Icon</label>
                <Input
                  value={form.icon}
                  onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
                  className="text-center text-lg"
                  maxLength={4}
                />
              </div>
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
                  placeholder="e.g. Kitchen & Dining"
                />
              </div>
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
              <label className="text-xs font-medium">Description</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Short description for landing pages…"
                rows={2}
              />
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
