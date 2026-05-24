import { useState, useRef, useEffect, useMemo } from "react";
import { toStorageThumbnail } from "@/lib/image-upload";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useUserRole } from "@/contexts/UserRoleContext";
import { getAdminProducts, getCategories, formatPrice, getProductClickCounts, getProductViewCounts, getAdminProductCategories } from "@/lib/supabase-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Pencil, Trash2, XCircle, ShieldCheck, Loader2, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, FilterX, Info, Search, ExternalLink } from "lucide-react";
import { MultiTagSelect } from "@/components/admin/MultiTagSelect";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { format } from "date-fns";

const safeFormat = (value: string | null | undefined, fmt: string) => {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : format(d, fmt);
};
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseTaxonomyString, stringifyTaxonomyValues } from "@/lib/taxonomy-utils";

/* ── Inline‑editable cell ── */
function InlineEdit({ value, onSave, type = "text", className }: { value: string; onSave: (v: string) => void; type?: "text" | "number"; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <span
        className={cn("cursor-pointer rounded px-1 -mx-1 hover:bg-muted transition-colors", className)}
        onClick={() => { setDraft(value); setEditing(true); }}
        title="Click to edit"
      >
        {type === "number" ? formatPrice(Number(value)) : value}
      </span>
    );
  }

  return (
    <Input
      ref={inputRef}
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
      className="h-7 w-full min-w-[80px] text-sm"
      step={type === "number" ? "0.01" : undefined}
    />
  );
}

interface Props {
  onEdit: (id: string) => void;
}

export default function ProductList({ onEdit }: Props) {
  const role = useUserRole();
  const isAdmin = role === "admin";
  const qc = useQueryClient();
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterVibe, setFilterVibe] = useState("all");
  const [filterVendor, setFilterVendor] = useState("all");
  const [filterMood, setFilterMood] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterError, setFilterError] = useState("all");
  const [filterCreator, setFilterCreator] = useState("all");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<"views" | "clicks" | "updated" | null>("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: getAdminProducts,
  });

  const { data: coreCategories = [] } = useQuery({
    queryKey: ["categories", "core"],
    queryFn: () => getCategories("core"),
    staleTime: 1000 * 60 * 30,
  });

  const { data: vibeCategories = [] } = useQuery({
    queryKey: ["categories", "vibe"],
    queryFn: () => getCategories("vibe"),
    staleTime: 1000 * 60 * 30,
  });

  const { data: moodCategories = [] } = useQuery({
    queryKey: ["categories", "mood"],
    queryFn: () => getCategories("mood"),
    staleTime: 1000 * 60 * 30,
  });
  const { data: productCategoryRows = [] } = useQuery({
    queryKey: ["admin-product-categories"],
    queryFn: getAdminProductCategories,
    staleTime: 1000 * 60 * 5,
  });

  const productCategoryMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const row of productCategoryRows) {
      const cat = coreCategories.find((c) => c.slug === row.category_slug);
      if (!cat) continue;
      if (!map[row.product_id]) map[row.product_id] = [];
      map[row.product_id].push(cat.name);
    }
    return map;
  }, [productCategoryRows, coreCategories]);

  const { data: brandsList = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  const { data: clickCounts = {} } = useQuery({
    queryKey: ["product-click-counts", 30],
    queryFn: () => getProductClickCounts(30),
    staleTime: 1000 * 60 * 5,
  });

  const { data: viewCounts = {} } = useQuery({
    queryKey: ["product-view-counts", 30],
    queryFn: () => getProductViewCounts(30),
    staleTime: 1000 * 60 * 5,
  });

  const inlineUpdateMut = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: "name" | "price" | "category" | "vibe_category" | "mood"; value: string }) => {
      const update = field === "price"
        ? { price: Number(value) }
        : {
            [field]: field === "category"
              ? stringifyTaxonomyValues(value.split(","))
              : stringifyTaxonomyValues(value.split(",")) || null,
          };
      (update as any).updated_at = new Date().toISOString();
      const { error } = await supabase.from("products").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-product-categories"] });
      toast.success("Updated");
    },
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // Block publishing if price is missing or below $5
      if (is_active) {
        const product = products.find((p: any) => p.id === id);
        const price = Number(product?.price);
        if (!product?.price || isNaN(price) || price < 5) {
          throw new Error("Cannot publish — set a price of at least $5.00 first.");
        }
      }
      const { error } = await supabase
        .from("products")
        .update({ is_active, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
    onError: (err: any) => toast.error(err.message || "Failed to update product"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product deleted");
    },
  });

  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("products").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_data, ids) => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setSelectedIds(new Set());
      toast.success(`${ids.length} product(s) deleted`);
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map((p) => p.id)));
    }
  };

  const [checkingLinks, setCheckingLinks] = useState(false);

  const handleCheckLinks = async () => {
    setCheckingLinks(true);
    try {
      const idsToCheck = paginated.map((p) => p.id);
      const { data, error } = await supabase.functions.invoke("check-affiliate-links", {
        body: { product_ids: idsToCheck },
      });
      if (error) throw error;
      const errors = data.results?.filter((r: any) => r.error) || [];
      if (errors.length > 0) {
        toast.error(`${errors.length} product(s) have link issues`, {
          description: errors.map((e: any) => `${e.name}: ${e.status}`).join(", "),
          duration: 10000,
        });
      } else {
        toast.success(`All ${data.checked} products checked — no issues found`);
      }
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (err: any) {
      toast.error("Link check failed: " + err.message);
    } finally {
      setCheckingLinks(false);
    }
  };

  const [matchingVendors, setMatchingVendors] = useState(false);
  const handleAutoMatchVendors = async () => {
    setMatchingVendors(true);
    try {
      const unmatched = products.filter((p) => !(p as any).vendor_id && p.source_url);
      let matched = 0;
      for (const product of unmatched) {
        try {
          const sourceHost = new URL(product.source_url).hostname.replace(/^www\./, "").toLowerCase();
          const brand = brandsList.find((b: any) => {
            try {
              const brandHost = new URL(b.affiliate_url || "").hostname.replace(/^www\./, "").toLowerCase();
              if (sourceHost.includes(brandHost) || brandHost.includes(sourceHost)) return true;
            } catch { /* skip invalid affiliate URLs */ }
            // Also match brand name against the source domain (e.g. "Target" matches "target.com")
            const brandName = (b.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            const domainBase = sourceHost.split(".")[0];
            return brandName === domainBase || domainBase.includes(brandName);
          });
          if (brand) {
            await supabase.from("products").update({ vendor_id: brand.id }).eq("id", product.id);
            matched++;
          }
        } catch { /* skip invalid URLs */ }
      }
      if (matched > 0) {
        qc.invalidateQueries({ queryKey: ["admin-products"] });
        toast.success(`Matched ${matched} product(s) to vendors`);
      } else {
        toast.info("No new vendor matches found");
      }
    } catch (err: any) {
      toast.error("Vendor matching failed: " + err.message);
    } finally {
      setMatchingVendors(false);
    }
  };
  const toggleSort = (col: "views" | "clicks" | "updated") => {
    if (sortColumn === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDir("desc");
    }
  };

  const filtered = products.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = (p.name || "").toLowerCase().includes(q);
      const matchCompany = (p.company_name || "").toLowerCase().includes(q);
      const matchCategory = (p.category || "").toLowerCase().includes(q);
      const matchVibe = (p.vibe_category || "").toLowerCase().includes(q);
      if (!matchName && !matchCompany && !matchCategory && !matchVibe) return false;
    }
    if (filterVendor !== "all") {
      if ((p as any).vendor_id !== filterVendor) return false;
    }
    if (filterCategory !== "all") {
      const cats = productCategoryMap[p.id] ?? parseTaxonomyString(p.category);
      if (!cats.includes(filterCategory)) return false;
    }
    if (filterVibe !== "all") {
      const vibes = parseTaxonomyString(p.vibe_category || "");
      if (!vibes.includes(filterVibe)) return false;
    }
    if (filterMood !== "all") {
      const moods = parseTaxonomyString(p.mood || "");
      if (!moods.includes(filterMood)) return false;
    }
    if (filterStatus === "active" && !p.is_active) return false;
    if (filterStatus === "inactive" && p.is_active) return false;
    if (filterError === "error" && !p.page_error) return false;
    if (filterError === "ok" && p.page_error) return false;
    if (filterCreator !== "all" && (p as any).created_by !== filterCreator) return false;
    if (filterSource !== "all" && (p as any).source !== filterSource) return false;
    if (dateFrom) {
      const added = new Date(p.date_added);
      if (added < dateFrom) return false;
    }
    if (dateTo) {
      const added = new Date(p.date_added);
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      if (added > endOfDay) return false;
    }
    return true;
  });

  // Sort by views/clicks if active
  const sorted = [...filtered];
  if (sortColumn === "updated") {
    sorted.sort((a, b) => {
      const aTime = new Date(a.updated_at).getTime();
      const bTime = new Date(b.updated_at).getTime();
      return sortDir === "asc" ? aTime - bTime : bTime - aTime;
    });
  } else if (sortColumn) {
    sorted.sort((a, b) => {
      const countsMap = sortColumn === "views" ? viewCounts : clickCounts;
      const aVal = countsMap[a.id] || 0;
      const bVal = countsMap[b.id] || 0;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setCurrentPage(1);
  };

  if (isLoading) return <div className="py-10 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      {/* Search + Filters + Actions */}
      <div className="relative w-full max-w-sm mb-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products, brands, categories…"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          className="pl-9 h-9"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckLinks}
            disabled={checkingLinks}
            className="gap-1.5"
          >
            {checkingLinks ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {checkingLinks ? "Checking…" : "Check Links"}
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs">
                <p>Verifies that each product's source URL is still active. Limited to the {paginated.length} products currently shown in the filtered list.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAutoMatchVendors}
          disabled={matchingVendors}
          className="gap-1.5"
        >
          {matchingVendors ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "🏷️"}
          {matchingVendors ? "Matching…" : "Auto-match Vendors"}
        </Button>
        <Select value={filterVendor} onValueChange={handleFilterChange(setFilterVendor)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {(() => {
              const vendorCounts: Record<string, number> = {};
              products.forEach((p: any) => {
                if (p.vendor_id && p.is_active) vendorCounts[p.vendor_id] = (vendorCounts[p.vendor_id] || 0) + 1;
              });
              const vendorIdsInUse = new Set(products.map((p: any) => p.vendor_id).filter(Boolean));
              return brandsList
                .filter((b: any) => vendorIdsInUse.has(b.id))
                .map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>{b.name} ({vendorCounts[b.id] || 0})</SelectItem>
                ));
            })()}
          </SelectContent>
        </Select>

        <Select value={filterSource} onValueChange={handleFilterChange(setFilterSource)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="shopify">Shopify</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterCategory} onValueChange={handleFilterChange(setFilterCategory)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {coreCategories.map((c) => (
              <SelectItem key={c.id} value={c.name}>{c.icon} {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterVibe} onValueChange={handleFilterChange(setFilterVibe)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Vibe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vibes</SelectItem>
            {vibeCategories.map((c) => (
              <SelectItem key={c.id} value={c.name}>{c.icon} {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterMood} onValueChange={handleFilterChange(setFilterMood)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Mood" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Moods</SelectItem>
            {moodCategories.map((c) => (
              <SelectItem key={c.id} value={c.name}>{c.icon} {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={handleFilterChange(setFilterStatus)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Draft / Inactive</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterError} onValueChange={handleFilterChange(setFilterError)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Page Error" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="error">Has Error</SelectItem>
            <SelectItem value="ok">No Error</SelectItem>
          </SelectContent>
        </Select>

        <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="20">20 per page</SelectItem>
            <SelectItem value="50">50 per page</SelectItem>
            <SelectItem value="100">100 per page</SelectItem>
          </SelectContent>
        </Select>

        {(() => {
          const creators = [...new Set(products.map((p: any) => p.created_by).filter(Boolean))];
          if (creators.length === 0) return null;
          return (
            <Select value={filterCreator} onValueChange={handleFilterChange(setFilterCreator)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Creator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Creators</SelectItem>
                {creators.map((email: string) => (
                  <SelectItem key={email} value={email}>{email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })()}

        {/* Date range filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left text-xs", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-1 h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, "MM/dd/yyyy") : "From date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setCurrentPage(1); }} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left text-xs", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-1 h-3.5 w-3.5" />
              {dateTo ? format(dateTo, "MM/dd/yyyy") : "To date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setCurrentPage(1); }} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setDateFrom(undefined); setDateTo(undefined); setCurrentPage(1); }}>
            Clear dates
          </Button>
        )}
        {(filterCategory !== "all" || filterVibe !== "all" || filterMood !== "all" || filterVendor !== "all" || filterStatus !== "all" || filterSource !== "all" || filterError !== "all" || filterCreator !== "all" || dateFrom || dateTo) && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => {
              setSearchQuery("");
              setFilterCategory("all");
              setFilterVibe("all");
              setFilterMood("all");
              setFilterVendor("all");
              setFilterStatus("all");
              setFilterSource("all");
              setFilterError("all");
              setFilterCreator("all");
              setDateFrom(undefined);
              setDateTo(undefined);
              setCurrentPage(1);
            }}
          >
            <FilterX className="h-3.5 w-3.5" />
            Clear All Filters
          </Button>
        )}
      </div>


      {isAdmin && selectedIds.size > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-1.5" disabled={bulkDeleteMut.isPending}>
                {bulkDeleteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete Selected
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {selectedIds.size} product(s)?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the selected products and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => bulkDeleteMut.mutate(Array.from(selectedIds))} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear selection</Button>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Showing {paginated.length} of {sorted.length} products
        {totalPages > 1 && ` — Page ${safePage} of ${totalPages}`}
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              {isAdmin && (
                <th className="px-3 py-3 w-10">
                  <Checkbox
                    checked={paginated.length > 0 && selectedIds.size === paginated.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
              )}
              <th className="px-4 py-3 font-medium">
                <button onClick={() => toggleSort("updated")} className="inline-flex items-center gap-1 hover:text-primary">
                  Product {sortColumn === "updated" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                </button>
              </th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Vibe</th>
              <th className="px-4 py-3 font-medium">Mood</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">
                <button onClick={() => toggleSort("views")} className="inline-flex items-center gap-1 hover:text-primary">
                  Views {sortColumn === "views" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                </button>
              </th>
              <th className="px-4 py-3 font-medium">
                <button onClick={() => toggleSort("clicks")} className="inline-flex items-center gap-1 hover:text-primary">
                  Clicks {sortColumn === "clicks" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                </button>
              </th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Error</th>
              <th className="px-4 py-3 font-medium">Created By</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((p) => (
              <tr key={p.id} className={cn("border-b last:border-0", selectedIds.has(p.id) && "bg-primary/5")}>
                {isAdmin && (
                  <td className="px-3 py-3">
                    <Checkbox
                      checked={selectedIds.has(p.id)}
                      onCheckedChange={() => toggleSelect(p.id)}
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.image_url ? (
                      <img
                        src={toStorageThumbnail(p.image_url)}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded object-cover bg-muted"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted text-lg">🛍️</div>
                    )}
                    <div className="min-w-0">
                      <InlineEdit
                        value={p.name}
                        onSave={(v) => inlineUpdateMut.mutate({ id: p.id, field: "name", value: v })}
                        className="font-medium"
                      />
                      <a href={`/product/${(p as any).slug || p.id}`} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex align-middle text-muted-foreground hover:text-primary" title="View product page">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      {p.company_name && (
                        <span className="ml-2 text-xs text-muted-foreground">{p.company_name}</span>
                      )}
                      <div className="text-[11px] text-muted-foreground">
                        Added {safeFormat(p.date_added, "MM/dd/yyyy")}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Updated {safeFormat(p.updated_at, "MM/dd/yyyy h:mm a")}
                        {(p as any).updated_by && (
                          <span className="ml-1">by {(p as any).updated_by}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <MultiTagSelect
                    value={stringifyTaxonomyValues(productCategoryMap[p.id] ?? parseTaxonomyString(p.category))}
                    options={coreCategories.map((c) => ({ name: c.name, icon: c.icon }))}
                    onSave={(v) => inlineUpdateMut.mutate({ id: p.id, field: "category", value: v })}
                  />
                </td>
                <td className="px-4 py-3">
                  <MultiTagSelect
                    value={p.vibe_category || ""}
                    options={vibeCategories.map((c) => ({ name: c.name, icon: c.icon }))}
                    onSave={(v) => inlineUpdateMut.mutate({ id: p.id, field: "vibe_category", value: v })}
                  />
                </td>
                <td className="px-4 py-3">
                  <MultiTagSelect
                    value={p.mood || ""}
                    options={moodCategories.map((c) => ({ name: c.name, icon: c.icon }))}
                    onSave={(v) => inlineUpdateMut.mutate({ id: p.id, field: "mood", value: v })}
                  />
                </td>
                <td className="px-4 py-3">
                  <InlineEdit
                    value={String(p.price)}
                    type="number"
                    onSave={(v) => inlineUpdateMut.mutate({ id: p.id, field: "price", value: v })}
                  />
                </td>
                <td className="px-4 py-3 text-center font-medium">{viewCounts[p.id] || 0}</td>
                <td className="px-4 py-3 text-center font-medium">{clickCounts[p.id] || 0}</td>
                <td className="px-4 py-3">
                  <Switch
                    checked={p.is_active}
                    onCheckedChange={(checked) =>
                      toggleMut.mutate({ id: p.id, is_active: checked })
                    }
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  {p.page_error && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <XCircle className="h-5 w-5 text-destructive inline-block cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs text-xs">{(p as any).page_error_detail || "Unknown error detected during link check"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {(p as any).created_by ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(p.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("Delete this product?")) deleteMut.mutate(p.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
                  No products match filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => setCurrentPage(safePage - 1)}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          {(() => {
            const MAX = 10;
            let start = Math.max(1, safePage - Math.floor(MAX / 2));
            let end = Math.min(totalPages, start + MAX - 1);
            start = Math.max(1, end - MAX + 1);
            const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
            return pages.map((page) => (
              <Button
                key={page}
                variant={page === safePage ? "default" : "outline"}
                size="sm"
                className="w-9"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ));
          })()}
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage(safePage + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
