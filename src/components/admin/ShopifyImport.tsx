import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight, Loader2, Store, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { generateSlug } from "@/lib/slug-utils";
import { stripHtml } from "@/lib/brand-utils";
import { stringifyTaxonomyValues } from "@/lib/taxonomy-utils";
import { formatPrice } from "@/lib/supabase-queries";

export interface ShopifyProduct {
  external_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  additional_images: string[];
  external_url: string;
  company_name: string;
}

interface ImportResult {
  name: string;
  success: boolean;
  error?: string;
}

export default function ShopifyImport() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<ImportResult[]>([]);

  const handleFetch = async () => {
    setLoading(true);
    setProducts([]);
    setSelected(new Set());
    setResults([]);

    try {
      const [invokeResult, existingResult] = await Promise.all([
        supabase.functions.invoke("shopify-fetch-products"),
        supabase.from("products").select("external_id").not("external_id", "is", null),
      ]);

      if (invokeResult.error) {
        let detail = invokeResult.error.message;
        try {
          const body = await (invokeResult.error as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch { /* ignore parse failure */ }
        throw new Error(detail);
      }

      const importedIds = new Set(
        (existingResult.data ?? []).map((r: any) => r.external_id).filter(Boolean)
      );

      const available: ShopifyProduct[] = (invokeResult.data?.products ?? []).filter(
        (p: ShopifyProduct) => !importedIds.has(p.external_id)
      );

      setProducts(available);

      if (available.length === 0) {
        toast.info("All Shopify products have already been imported.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to fetch Shopify products");
    } finally {
      setLoading(false);
    }
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(products.map((p) => p.external_id)) : new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleImport = async () => {
    const toImport = products.filter((p) => selected.has(p.external_id));
    if (toImport.length === 0) return;

    setImporting(true);
    const importResults: ImportResult[] = [];

    for (const p of toImport) {
      try {
        const { data: inserted, error } = await supabase
          .from("products")
          .insert([{
            name: p.name,
            description: stripHtml(p.description || ""),
            price: p.price,
            image_url: p.image_url,
            affiliate_url: p.external_url,
            source_url: p.external_url,
            external_url: p.external_url,
            external_id: p.external_id,
            source: "shopify",
            category: stringifyTaxonomyValues([]),
            company_name: p.company_name || null,
            is_active: false,
            regions: ["US"],
            slug: generateSlug(p.name),
            price_below_msrp: false,
            vendor_id: null,
          }])
          .select("id")
          .single();

        if (error) throw error;

        if (inserted && p.additional_images.length > 0) {
          await supabase.from("product_images").insert(
            p.additional_images.map((url, i) => ({
              product_id: inserted.id,
              image_url: url,
              display_order: i + 1,
            }))
          );
        }

        importResults.push({ name: p.name, success: true });
      } catch (err: any) {
        importResults.push({ name: p.name, success: false, error: err.message || "Unknown error" });
      }
    }

    setResults(importResults);
    setImporting(false);

    const succeeded = importResults.filter((r) => r.success).length;
    const failed = importResults.filter((r) => !r.success).length;

    if (succeeded > 0) {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      const failedNames = new Set(importResults.filter((r) => !r.success).map((r) => r.name));
      setProducts((prev) => prev.filter((p) => failedNames.has(p.name)));
      setSelected(new Set());
    }

    if (failed > 0 && succeeded > 0) {
      toast.warning(`${succeeded} product(s) added as drafts, ${failed} failed`, { duration: 6000 });
    } else if (failed > 0 && succeeded === 0) {
      toast.error(`All ${failed} import(s) failed — see details below`, { duration: 6000 });
    } else {
      toast.success(`${succeeded} product(s) added as drafts — review before publishing`, { duration: 6000 });
    }
  };

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/30 rounded-lg transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 font-medium">
          <Store className="h-4 w-4" />
          Import from Shopify
        </div>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="border-t p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleFetch}
              disabled={loading || importing}
              variant="outline"
              className="gap-2"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Fetching…</>
              ) : (
                "Load Shopify Products"
              )}
            </Button>
            {products.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {products.length} available to import
              </span>
            )}
          </div>

          {products.length > 0 && (
            <>
              <div className="rounded-lg border overflow-hidden">
                <div className="flex items-center gap-3 border-b bg-muted/30 px-3 py-2">
                  <Checkbox
                    checked={selected.size === products.length && products.length > 0}
                    onCheckedChange={(v) => toggleAll(!!v)}
                  />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {selected.size > 0 ? `${selected.size} selected` : "Select all"}
                  </span>
                </div>
                <div className="divide-y max-h-80 overflow-y-auto">
                  {products.map((p) => (
                    <div key={p.external_id} className="flex items-center gap-3 px-3 py-2.5">
                      <Checkbox
                        checked={selected.has(p.external_id)}
                        onCheckedChange={(v) => toggleOne(p.external_id, !!v)}
                      />
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-12 w-12 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded bg-muted shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{formatPrice(p.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleImport}
                disabled={importing || selected.size === 0}
                className="gap-2"
              >
                {importing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
                ) : (
                  `Import ${selected.size > 0 ? selected.size + " " : ""}Selected`
                )}
              </Button>
            </>
          )}

          {results.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <h4 className="text-sm font-medium mb-2">
                Import Results — {results.filter((r) => r.success).length} succeeded,{" "}
                {results.filter((r) => !r.success).length} failed
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    {r.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    )}
                    <div>
                      <span className="font-medium">{r.name}</span>
                      {r.error && <span className="text-destructive ml-1">({r.error})</span>}
                      {r.success && <span className="text-muted-foreground ml-1">(saved as draft)</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
