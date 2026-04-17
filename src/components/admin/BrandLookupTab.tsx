import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
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
import { Plus, Pencil, Trash2, Loader2, Search, FlaskConical, X } from "lucide-react";
import { toast } from "sonner";

interface BrandRow {
  id: string;
  brand: string;
  match_aliases: string[];
  url_match: string;
  group_name: string | null;
  source: string | null;
  core: string[] | null;
  vibes: string[] | null;
  moods: string[] | null;
  hint: string | null;
  created_at: string;
}

interface BrandForm {
  brand: string;
  match_aliases: string[];
  url_match: string;
  group_name: string;
  source: string;
  core: string[];
  vibes: string[];
  moods: string[];
  hint: string;
}

const emptyForm: BrandForm = {
  brand: "", match_aliases: [], url_match: "", group_name: "", source: "vendor",
  core: [], vibes: [], moods: [], hint: "",
};

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (!value.includes(input.trim())) onChange([...value, input.trim()]);
      setInput("");
    }
  };
  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-input bg-background px-2 py-1.5 min-h-[36px] items-center">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">
          {t}
          <button type="button" onClick={() => onChange(value.filter((v) => v !== t))} className="ml-0.5 hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[80px] bg-transparent text-xs outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

function CategoryPillSelect({ value, onChange, options }: { value: string[]; onChange: (v: string[]) => void; options: { name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = options.filter((o) => !value.includes(o.name) && o.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative">
      <div
        className="flex flex-wrap gap-1 rounded-md border border-input bg-background px-2 py-1.5 min-h-[36px] items-center cursor-pointer"
        onClick={() => setOpen(true)}
      >
        {value.length === 0 && <span className="text-xs text-muted-foreground">Click to select…</span>}
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">
            {t}
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(value.filter((v) => v !== t)); }} className="ml-0.5 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md max-h-48 overflow-y-auto">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder="Search…"
            className="w-full bg-transparent text-xs outline-none px-2 py-1.5 border-b mb-1 placeholder:text-muted-foreground"
          />
          {filtered.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No options</div>
          ) : filtered.map((o) => (
            <button
              key={o.name}
              type="button"
              onClick={() => { onChange([...value, o.name]); setSearch(""); }}
              className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
            >
              {o.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BrandLookupTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BrandRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BrandForm>(emptyForm);
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ["brand-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_lookup")
        .select("*")
        .order("brand");
      if (error) throw error;
      return data as unknown as BrandRow[];
    },
  });

  const { data: catOptions = [] } = useQuery({
    queryKey: ["categories-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("name, type").order("name");
      if (error) throw error;
      return data;
    },
  });

  const coreOpts = catOptions.filter((c) => c.type === "core").map((c) => ({ name: c.name }));
  const vibeOpts = catOptions.filter((c) => c.type === "vibe").map((c) => ({ name: c.name }));
  const moodOpts = catOptions.filter((c) => c.type === "mood").map((c) => ({ name: c.name }));

  const groups = useMemo(() => {
    const set = new Set(brands.map((b) => b.group_name).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [brands]);

  const filtered = useMemo(() => {
    let list = brands;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((b) => b.brand.toLowerCase().includes(q) || b.url_match.toLowerCase().includes(q));
    }
    if (groupFilter) list = list.filter((b) => b.group_name === groupFilter);
    return list;
  }, [brands, search, groupFilter]);

  const saveMut = useMutation({
    mutationFn: async (data: BrandForm & { id?: string }) => {
      const payload = {
        brand: data.brand.trim(),
        match_aliases: data.match_aliases,
        url_match: data.url_match.trim(),
        group_name: data.group_name.trim() || null,
        source: data.source || null,
        core: data.core.length ? data.core : null,
        vibes: data.vibes.length ? data.vibes : null,
        moods: data.moods.length ? data.moods : null,
        hint: data.hint.trim() || null,
      };
      if (data.id) {
        const { error } = await supabase.from("brand_lookup").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("brand_lookup").upsert(payload, { onConflict: "brand" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand-lookup"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(editingId ? "Brand updated" : "Brand added");
    },
    onError: (err: any) => toast.error("Failed: " + err.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("brand_lookup").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand-lookup"] });
      setDeleteTarget(null);
      toast.success("Brand deleted");
    },
    onError: (err: any) => toast.error("Failed: " + err.message),
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (b: BrandRow) => {
    setEditingId(b.id);
    setForm({
      brand: b.brand,
      match_aliases: b.match_aliases || [],
      url_match: b.url_match || "",
      group_name: b.group_name || "",
      source: b.source || "vendor",
      core: b.core || [],
      vibes: b.vibes || [],
      moods: b.moods || [],
      hint: b.hint || "",
    });
    setDialogOpen(true);
  };

  const handleTest = async () => {
    const input = testInput.trim().toLowerCase();
    if (!input) return;
    setTesting(true);
    setTestResult(null);

    // URL match first
    const urlMatched = brands.find((b) => b.url_match && input.includes(b.url_match));
    if (urlMatched) {
      setTestResult({ matched: true, brand: urlMatched, method: "URL match" });
      setTesting(false);
      return;
    }

    // Alias match
    const aliasMatched = brands.find((b) =>
      b.match_aliases.some((a) => a.toLowerCase() === input)
    );
    if (aliasMatched) {
      setTestResult({ matched: true, brand: aliasMatched, method: "Alias match" });
      setTesting(false);
      return;
    }

    setTestResult({ matched: false });
    setTesting(false);
  };

  if (isLoading) {
    return <div className="py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brands or URLs…"
            className="pl-9"
          />
        </div>
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All groups</option>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <Button size="sm" className="gap-1.5 h-10" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add Brand
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Brand</th>
              <th className="px-4 py-3 font-medium">URL Match</th>
              <th className="px-4 py-3 font-medium">Group</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Default Categories</th>
              <th className="px-4 py-3 font-medium">Hint</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-medium whitespace-nowrap">{b.brand}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.url_match || "—"}</td>
                <td className="px-4 py-3 text-xs">{b.group_name || "—"}</td>
                <td className="px-4 py-3">
                  {b.source === "vendor" ? (
                    <Badge className="text-[10px] bg-blue-500/15 text-blue-700 border-blue-200 hover:bg-blue-500/20">vendor</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">{b.source || "—"}</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(b.core || []).slice(0, 3).map((c) => (
                      <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                    ))}
                    {(b.core || []).length > 3 && (
                      <Badge variant="outline" className="text-[10px]">+{(b.core || []).length - 3} more</Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                  {b.hint ? (b.hint.length > 60 ? b.hint.slice(0, 60) + "…" : b.hint) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(b)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No brands found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Test Match */}
      <div className="rounded-xl border p-4 space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" /> Test Brand Match
        </h3>
        <div className="flex gap-2">
          <Input
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="Type a brand name or paste a URL…"
            onKeyDown={(e) => e.key === "Enter" && handleTest()}
          />
          <Button size="sm" onClick={handleTest} disabled={testing} className="shrink-0">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
          </Button>
        </div>
        {testResult && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
            {testResult.matched ? (
              <>
                <p className="font-medium text-green-700">✓ Matched: {testResult.brand.brand} <span className="text-xs text-muted-foreground">({testResult.method})</span></p>
                {testResult.brand.hint && <p className="text-xs"><span className="font-medium">Hint:</span> {testResult.brand.hint}</p>}
                {testResult.brand.core?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs font-medium mr-1">Core:</span>
                    {testResult.brand.core.map((c: string) => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
                  </div>
                )}
                {testResult.brand.vibes?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs font-medium mr-1">Vibes:</span>
                    {testResult.brand.vibes.map((v: string) => <Badge key={v} variant="outline" className="text-[10px]">{v}</Badge>)}
                  </div>
                )}
                {testResult.brand.moods?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs font-medium mr-1">Moods:</span>
                    {testResult.brand.moods.map((m: string) => <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>)}
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No match found</p>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Add"} Brand</DialogTitle>
            <DialogDescription>Configure brand matching rules and default AI category hints.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Brand Name *</label>
              <Input value={form.brand} onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))} placeholder="e.g. Lululemon" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Match Aliases</label>
              <TagInput value={form.match_aliases} onChange={(v) => setForm((p) => ({ ...p, match_aliases: v }))} placeholder="Type alias + Enter" />
              <p className="text-[11px] text-muted-foreground">Alternative names the AI uses to match this brand</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">URL Match</label>
              <Input value={form.url_match} onChange={(e) => setForm((p) => ({ ...p, url_match: e.target.value }))} placeholder="e.g. lululemon.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Group</label>
                <Input value={form.group_name} onChange={(e) => setForm((p) => ({ ...p, group_name: e.target.value }))} placeholder="e.g. sports_athletic" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Source</label>
                <select
                  value={form.source}
                  onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="vendor">vendor</option>
                  <option value="popular">popular</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Default Core Categories</label>
              <CategoryPillSelect value={form.core} onChange={(v) => setForm((p) => ({ ...p, core: v }))} options={coreOpts} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Default Vibes</label>
              <CategoryPillSelect value={form.vibes} onChange={(v) => setForm((p) => ({ ...p, vibes: v }))} options={vibeOpts} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Default Moods</label>
              <CategoryPillSelect value={form.moods} onChange={(v) => setForm((p) => ({ ...p, moods: v }))} options={moodOpts} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Brand Hint</label>
              <Textarea
                value={form.hint}
                onChange={(e) => setForm((p) => ({ ...p, hint: e.target.value.slice(0, 300) }))}
                placeholder="e.g. Premium yoga-to-street activewear; lean toward Get Sporty and The Wellness Era"
                rows={3}
                maxLength={300}
              />
              <p className="text-[11px] text-muted-foreground">{form.hint.length}/300 — plain-English guidance injected into the AI prompt</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!form.brand.trim()) return toast.error("Brand name is required");
              saveMut.mutate({ ...form, id: editingId || undefined });
            }} disabled={saveMut.isPending} className="gap-1.5">
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Save Changes" : "Add Brand"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.brand}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the brand lookup entry. The AI will no longer inject brand-specific hints for this brand.
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
    </div>
  );
}
