import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle, Trash2, Eye, ExternalLink } from "lucide-react";
import type { Product } from "@/lib/supabase-queries";

type StatusFilter = "flagged" | "unpublished" | "all";

export default function FlaggedProductsDashboard() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("flagged");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["flagged-products", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .order("report_count", { ascending: false });

      if (statusFilter === "all") {
        query = query.in("status", ["flagged", "unpublished"]);
      } else {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
  });

  const bulkMut = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: "active" | "unpublished" | "delete" }) => {
      if (action === "delete") {
        const { error } = await supabase.from("products").delete().in("id", ids);
        if (error) throw error;
      } else {
        const update: Record<string, any> = { status: action };
        if (action === "active") {
          update.report_count = 0;
          update.check_failure_count = 0;
          update.page_error_detail = null;
        }
        const { error } = await supabase.from("products").update(update).in("id", ids);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flagged-products"] });
      setSelected(new Set());
      toast.success("Products updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === products.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => p.id)));
    }
  };

  const selectedIds = Array.from(selected);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold">Products Needing Attention</h2>
          <Badge variant="destructive">{products.length}</Badge>
        </div>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flagged">Flagged</SelectItem>
              <SelectItem value="unpublished">Unpublished</SelectItem>
              <SelectItem value="all">All Issues</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
          <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => bulkMut.mutate({ ids: selectedIds, action: "active" })}
          >
            <CheckCircle className="h-3.5 w-3.5" /> Clear Flag
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => bulkMut.mutate({ ids: selectedIds, action: "unpublished" })}
          >
            <Eye className="h-3.5 w-3.5" /> Unpublish
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="gap-1"
            onClick={() => bulkMut.mutate({ ids: selectedIds, action: "delete" })}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Loading…</div>
      ) : products.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">
          <CheckCircle className="mx-auto mb-2 h-8 w-8 text-primary" />
          No products need attention right now.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selected.size === products.length && products.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-center">Reports</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Error Detail</TableHead>
                <TableHead>Last Click</TableHead>
                <TableHead>Last Verified</TableHead>
                <TableHead className="text-center">HTTP</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggleSelect(p.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px]">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.company_name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(() => {
                      try { return new URL(p.affiliate_url).hostname.replace(/^www\./, ""); }
                      catch { return "—"; }
                    })()}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={p.report_count >= 3 ? "destructive" : "secondary"}>
                      {p.report_count}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === "flagged" ? "default" : "destructive"} className="text-xs">
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate" title={p.page_error_detail || ""}>
                    {p.page_error_detail || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.last_click_at ? format(new Date(p.last_click_at), "MM/dd HH:mm") : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.last_verified_at ? format(new Date(p.last_verified_at), "MM/dd HH:mm") : "—"}
                  </TableCell>
                  <TableCell className="text-center text-xs">
                    {p.last_status_code || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        asChild
                      >
                        <a href={p.affiliate_url} target="_blank" rel="noopener noreferrer" title="Test link">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => bulkMut.mutate({ ids: [p.id], action: "active" })}
                      >
                        Clear
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
