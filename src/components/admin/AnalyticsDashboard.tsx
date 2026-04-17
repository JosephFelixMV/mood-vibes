import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getCategories } from "@/lib/supabase-queries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

type SortOption = "views-desc" | "views-asc" | "clicks-desc" | "clicks-asc" | "products-desc" | "products-asc";

function getDefaultRange() {
  const now = new Date();
  // Default to last 30 days
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  return {
    fromYear: from.getFullYear(),
    fromMonth: from.getMonth(),
    toYear: now.getFullYear(),
    toMonth: now.getMonth(),
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function MonthYearPicker({ label, month, year, onChange }: {
  label: string;
  month: number;
  year: number;
  onChange: (m: number, y: number) => void;
}) {
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <Select value={String(month)} onValueChange={(v) => onChange(Number(v), year)}>
        <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={String(year)} onValueChange={(v) => onChange(month, Number(v))}>
        <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [categoryType, setCategoryType] = useState<"core" | "vibe">("core");
  const [sortBy, setSortBy] = useState<SortOption>("views-desc");
  const [selectedCategories, setSelectedCategories] = useState<Set<string> | null>(null);
  const defaults = getDefaultRange();
  const [fromMonth, setFromMonth] = useState(defaults.fromMonth);
  const [fromYear, setFromYear] = useState(defaults.fromYear);
  const [toMonth, setToMonth] = useState(defaults.toMonth);
  const [toYear, setToYear] = useState(defaults.toYear);

  const fromDate = new Date(fromYear, fromMonth, 1).toISOString();
  const toDate = new Date(toYear, toMonth + 1, 0, 23, 59, 59).toISOString();

  const { data: coreCategories = [] } = useQuery({
    queryKey: ["categories", "core"],
    queryFn: () => getCategories("core"),
  });

  const { data: vibeCategories = [] } = useQuery({
    queryKey: ["categories", "vibe"],
    queryFn: () => getCategories("vibe"),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["analytics-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, category, vibe_category");
      if (error) throw error;
      return data;
    },
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["analytics-events", fromDate, toDate],
    queryFn: async () => {
      // Fetch views from product_events
      const { data: viewData, error: viewErr } = await supabase
        .from("product_events")
        .select("product_id, event_type")
        .eq("event_type", "view")
        .gte("created_at", fromDate)
        .lte("created_at", toDate);
      if (viewErr) throw viewErr;

      // Fetch clicks from product_clicks (the primary click store)
      const { data: clickData, error: clickErr } = await supabase
        .from("product_clicks")
        .select("product_id, clicked_at")
        .gte("clicked_at", fromDate)
        .lte("clicked_at", toDate);
      if (clickErr) throw clickErr;

      // Merge into unified format
      const merged: { product_id: string; event_type: string }[] = [
        ...(viewData || []).map((r) => ({ product_id: r.product_id, event_type: "view" })),
        ...(clickData || []).map((r) => ({ product_id: r.product_id, event_type: "click" })),
      ];

      // Also fetch clicks from product_events (in case some were recorded there)
      const { data: eventClicks, error: ecErr } = await supabase
        .from("product_events")
        .select("product_id, event_type")
        .eq("event_type", "click")
        .gte("created_at", fromDate)
        .lte("created_at", toDate);
      if (!ecErr && eventClicks) {
        merged.push(...eventClicks.map((r) => ({ product_id: r.product_id, event_type: "click" })));
      }

      return merged;
    },
  });

  const availableCategories = useMemo(() => {
    if (categoryType === "core") {
      return coreCategories.filter((c) => !!c.parent_slug).map((c) => c.name);
    }
    return vibeCategories.map((c) => c.name);
  }, [categoryType, coreCategories, vibeCategories]);

  // When category type changes or categories load, select all
  const activeSelected = useMemo(() => {
    if (selectedCategories === null) return new Set(availableCategories);
    return selectedCategories;
  }, [selectedCategories, availableCategories]);

  const toggleCategory = (cat: string) => {
    const next = new Set(activeSelected);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setSelectedCategories(next);
  };

  const selectAll = () => setSelectedCategories(null);

  const tableData = useMemo(() => {
    // Build product -> category mapping
    const productCatMap: Record<string, string[]> = {};
    products.forEach((p) => {
      const field = categoryType === "core" ? p.category : p.vibe_category;
      if (!field) {
        if (categoryType === "vibe") {
          productCatMap[p.id] = ["No Vibe"];
        }
        return;
      }
      productCatMap[p.id] = field.split(",").map((c: string) => c.trim()).filter(Boolean);
    });

    // Aggregate events by category
    const catStats: Record<string, { views: number; clicks: number; productIds: Set<string> }> = {};

    events.forEach((e) => {
      const cats = productCatMap[e.product_id] || [];
      cats.forEach((cat) => {
        if (!catStats[cat]) catStats[cat] = { views: 0, clicks: 0, productIds: new Set() };
        catStats[cat].productIds.add(e.product_id);
        if (e.event_type === "view") catStats[cat].views++;
        else catStats[cat].clicks++;
      });
    });

    // Also count products per category (even those without events)
    products.forEach((p) => {
      const cats = productCatMap[p.id] || [];
      cats.forEach((cat) => {
        if (!catStats[cat]) catStats[cat] = { views: 0, clicks: 0, productIds: new Set() };
        catStats[cat].productIds.add(p.id);
      });
    });

    let rows = Object.entries(catStats)
      .filter(([cat]) => activeSelected.has(cat))
      .map(([cat, stats]) => ({
        category: cat,
        productCount: stats.productIds.size,
        views: stats.views,
        clicks: stats.clicks,
      }));

    // Sort
    rows.sort((a, b) => {
      switch (sortBy) {
        case "views-desc": return b.views - a.views;
        case "views-asc": return a.views - b.views;
        case "clicks-desc": return b.clicks - a.clicks;
        case "clicks-asc": return a.clicks - b.clicks;
        case "products-desc": return b.productCount - a.productCount;
        case "products-asc": return a.productCount - b.productCount;
      }
    });

    return rows;
  }, [products, events, categoryType, activeSelected, sortBy]);

  const totals = useMemo(() => {
    return tableData.reduce((acc, r) => ({
      products: acc.products + r.productCount,
      views: acc.views + r.views,
      clicks: acc.clicks + r.clicks,
    }), { products: 0, views: 0, clicks: 0 });
  }, [tableData]);

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-xl font-semibold">Analytics</h2>

      {/* Filters */}
      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <ToggleGroup
            type="single"
            value={categoryType}
            onValueChange={(v) => {
              if (v) {
                setCategoryType(v as "core" | "vibe");
                setSelectedCategories(null);
              }
            }}
          >
            <ToggleGroupItem value="core" className="rounded-full px-4">Core Lifestyle</ToggleGroupItem>
            <ToggleGroupItem value="vibe" className="rounded-full px-4">Vibe</ToggleGroupItem>
          </ToggleGroup>

        </div>

        <div className="flex flex-wrap items-center gap-4">
          <MonthYearPicker label="From" month={fromMonth} year={fromYear} onChange={(m, y) => { setFromMonth(m); setFromYear(y); }} />
          <MonthYearPicker label="To" month={toMonth} year={toYear} onChange={(m, y) => { setToMonth(m); setToYear(y); }} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Categories:</span>
            <button onClick={selectAll} className="text-xs text-primary hover:underline">Select All</button>
            <button onClick={() => setSelectedCategories(new Set())} className="text-xs text-primary hover:underline">Deselect All</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableCategories.map((cat) => (
              <label key={cat} className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={activeSelected.has(cat)}
                  onCheckedChange={() => toggleCategory(cat)}
                />
                <span className="text-sm">{cat}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Category</th>
                <th
                  className="px-4 py-3 font-medium text-center cursor-pointer select-none hover:text-primary transition-colors"
                  onClick={() => setSortBy(sortBy === "products-desc" ? "products-asc" : "products-desc")}
                >
                  Products {sortBy === "products-asc" ? "↑" : sortBy === "products-desc" ? "↓" : ""}
                </th>
                <th
                  className="px-4 py-3 font-medium text-center cursor-pointer select-none hover:text-primary transition-colors"
                  onClick={() => setSortBy(sortBy === "views-desc" ? "views-asc" : "views-desc")}
                >
                  Total Views {sortBy === "views-asc" ? "↑" : sortBy === "views-desc" ? "↓" : ""}
                </th>
                <th
                  className="px-4 py-3 font-medium text-center cursor-pointer select-none hover:text-primary transition-colors"
                  onClick={() => setSortBy(sortBy === "clicks-desc" ? "clicks-asc" : "clicks-desc")}
                >
                  Total Clicks {sortBy === "clicks-asc" ? "↑" : sortBy === "clicks-desc" ? "↓" : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row) => (
                <tr key={row.category} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{row.category}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">{row.productCount}</td>
                  <td className="px-4 py-3 text-center font-medium">{row.views}</td>
                  <td className="px-4 py-3 text-center font-medium">{row.clicks}</td>
                </tr>
              ))}
              {tableData.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    No data for the selected filters
                  </td>
                </tr>
              )}
            </tbody>
            {tableData.length > 0 && (
              <tfoot className="border-t bg-muted/30">
                <tr>
                  <td className="px-4 py-3 font-semibold">Totals</td>
                  <td className="px-4 py-3 text-center font-semibold">{totals.products}</td>
                  <td className="px-4 py-3 text-center font-semibold">{totals.views}</td>
                  <td className="px-4 py-3 text-center font-semibold">{totals.clicks}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
