import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, FileUp, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generateSlug } from "@/lib/slug-utils";
import { stripHtml } from "@/lib/brand-utils";
import { stringifyTaxonomyValues, dedupeTaxonomyValues } from "@/lib/taxonomy-utils";

interface UploadResult {
  fileName: string;
  success: boolean;
  productName?: string;
  error?: string;
}

export default function BulkUpload() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const { data: brandsList = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name, affiliate_url").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const processFiles = async (files: FileList) => {
    setUploading(true);
    setResults([]);
    const uploadResults: UploadResult[] = [];

    for (const file of Array.from(files)) {
      if (!file.name.endsWith(".json")) {
        uploadResults.push({ fileName: file.name, success: false, error: "Not a JSON file" });
        continue;
      }

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validate required fields
        if (!data.name?.trim()) {
          uploadResults.push({ fileName: file.name, success: false, error: "Missing product name" });
          continue;
        }
        if (!data.affiliate_url?.trim()) {
          uploadResults.push({ fileName: file.name, success: false, error: "Missing affiliate URL" });
          continue;
        }

        // Check for duplicate by name (includes drafts)
        const { data: dupes } = await supabase
          .from("products")
          .select("id, is_active")
          .ilike("name", data.name.trim())
          .limit(1);

        if (dupes && dupes.length > 0) {
          const isDraft = !dupes[0].is_active;
          uploadResults.push({
            fileName: file.name,
            success: false,
            productName: data.name,
            error: isDraft
              ? "Duplicate — a draft with this name already exists"
              : "Duplicate — a published product with this name already exists",
          });
          continue;
        }

        const parsedPrice = typeof data.price === "string"
          ? parseFloat(data.price.replace(/[^0-9.]/g, "")) || 0
          : (data.price || 0);
        // Price below $5 is allowed for drafts — the product just can't be published
        // until an admin sets a valid price. No rejection here.

        // Auto-match vendor from source_url
        let vendorId: string | null = null;
        const sourceUrl = data.source_url || data.affiliate_url || "";
        if (sourceUrl && brandsList.length > 0) {
          try {
            const sourceHost = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
            const match = brandsList.find((b: any) => {
              try {
                const brandHost = new URL(b.affiliate_url).hostname.replace(/^www\./, "").toLowerCase();
                if (sourceHost.includes(brandHost) || brandHost.includes(sourceHost)) return true;
              } catch { /* skip */ }
              const brandName = (b.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
              const domainBase = sourceHost.split(".")[0];
              return brandName === domainBase || domainBase.includes(brandName);
            });
            if (match) vendorId = match.id;
          } catch { /* invalid URL */ }
        }

        // Insert product as draft (is_active = false)
        const { data: inserted, error } = await supabase
          .from("products")
          .insert([{
            name: data.name.trim(),
            description: stripHtml(data.description || ""),
            price: parsedPrice,
            image_url: data.image_url || null,
            affiliate_url: data.affiliate_url.trim(),
            source_url: data.source_url || "",
            category: stringifyTaxonomyValues((data.category || "").split(",")),
            company_name: data.company_name || null,
            is_active: false, // Draft
            vibe_category: stringifyTaxonomyValues((data.vibe_category || "").split(",")) || null,
            video_url: data.video_url || null,
            slug: generateSlug(data.name.trim()),
            vendor_id: vendorId,
          }])
          .select("id")
          .single();

        if (error) throw error;

        // AI category suggestion — update product with suggested categories
        if (inserted) {
          try {
            const matchedVendorName = vendorId ? brandsList.find((b: any) => b.id === vendorId)?.name : undefined;
            const { data: aiData } = await supabase.functions.invoke("suggest-categories", {
              body: { name: data.name.trim(), description: data.description || "", price: parsedPrice, source_url: sourceUrl, vendor_name: matchedVendorName, company_name: matchedVendorName },
            });
            if (aiData) {
              const updates: { category?: string; vibe_category?: string } = {};
              if (aiData.core?.length) updates.category = stringifyTaxonomyValues(dedupeTaxonomyValues(aiData.core));
              if (aiData.vibes?.length) updates.vibe_category = stringifyTaxonomyValues(dedupeTaxonomyValues(aiData.vibes));
              if (Object.keys(updates).length > 0) {
                await supabase.from("products").update(updates).eq("id", inserted.id);
              }
            }
          } catch {
            // Silently continue — categories can be set manually
          }
        }

        // Insert additional images
        const images = Array.isArray(data.additional_images)
          ? data.additional_images.filter((url: string) => url?.trim()).slice(0, 4)
          : [];
        if (images.length > 0 && inserted) {
          await supabase.from("product_images").insert(
            images.map((url: string, i: number) => ({
              product_id: inserted.id,
              image_url: url.trim(),
              display_order: i + 1,
            }))
          );
        }

        // Insert specifications
        const specs = Array.isArray(data.specifications)
          ? data.specifications.filter((s: any) => s?.item_detail?.trim() && s?.specification?.trim())
          : [];
        if (specs.length > 0 && inserted) {
          await supabase.from("product_specifications").insert(
            specs.map((s: any, i: number) => ({
              product_id: inserted.id,
              item_detail: s.item_detail.trim(),
              specification: s.specification.trim(),
              display_order: i + 1,
            }))
          );
        }

        uploadResults.push({ fileName: file.name, success: true, productName: data.name });
      } catch (err: any) {
        const msg = err instanceof SyntaxError ? "Invalid JSON format" : (err.message || "Unknown error");
        uploadResults.push({ fileName: file.name, success: false, error: msg });
      }
    }

    setResults(uploadResults);
    setUploading(false);

    const succeeded = uploadResults.filter((r) => r.success).length;
    const skipped = uploadResults.filter((r) => !r.success).length;

    if (succeeded > 0) {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    }

    if (skipped > 0 && succeeded > 0) {
      toast.warning(`${succeeded} product(s) added as drafts, ${skipped} file(s) skipped`, { duration: 6000 });
    } else if (skipped > 0 && succeeded === 0) {
      toast.error(`All ${skipped} file(s) were skipped — see details below`, { duration: 6000 });
    } else {
      toast.success(`${succeeded} product(s) added as drafts — review before publishing`, { duration: 6000 });
    }

    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
        <FileUp className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <h3 className="text-lg font-medium mb-1">Bulk Upload Products</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Upload multiple JSON template files. Products will be saved as <strong>drafts</strong> for review.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />
        <Button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="gap-2"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Processing…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" /> Select JSON Files
            </>
          )}
        </Button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <h4 className="text-sm font-medium mb-2">
            Upload Results — {results.filter((r) => r.success).length} succeeded, {results.filter((r) => !r.success).length} skipped
          </h4>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {r.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                )}
                <div>
                  <span className="font-medium">{r.fileName}</span>
                  {r.productName && <span className="text-muted-foreground"> — {r.productName}</span>}
                  {r.error && <span className="text-destructive ml-1">({r.error})</span>}
                  {r.success && <span className="text-muted-foreground ml-1">(saved as draft)</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
