import { useEffect, useState, useRef, MutableRefObject } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getProduct, getCategories } from "@/lib/supabase-queries";
import { generateSlug } from "@/lib/slug-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RichTextEditor from "@/components/RichTextEditor";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Upload, Download, Info, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ProductCard from "@/components/ProductCard";
import { toast } from "sonner";
import type { Product } from "@/lib/supabase-queries";
import { formatPrice } from "@/lib/supabase-queries";

interface Props {
  editId: string | null;
  onDone: () => void;
  savedState?: MutableRefObject<Record<string, any> | null>;
}

interface SpecRow {
  item_detail: string;
  specification: string;
}

const AVAILABLE_REGIONS = [
  { code: "US", label: "🇺🇸 United States" },
  { code: "CA", label: "🇨🇦 Canada" },
  { code: "Intl", label: "🌍 International" },
] as const;

const FASHION_SUBCATEGORIES = [
  "womens-fashion", "mens-fashion", "womens-shoes", "mens-shoes", "activewear",
  "Women's Fashion", "Men's Fashion", "Women's Shoes", "Men's Shoes", "Activewear",
];

function inferFashionAttributes(keywords: string[]): { season: string; warmth: string } {
  const kws = keywords.map((k) => k.toLowerCase());
  const fallWinterTerms = ["wool", "knit", "fleece", "flannel", "puffer", "thermal", "turtleneck", "fall", "winter", "sherpa", "down", "cashmere", "heavyweight", "insulated", "corduroy"];
  const springSummerTerms = ["linen", "cotton", "sleeveless", "shorts", "floral", "lightweight", "breathable", "spring", "summer", "tank", "mesh", "seersucker"];
  const lightTerms = ["linen", "mesh", "tank", "sleeveless", "breathable", "sheer"];
  const midLayerTerms = ["cotton", "denim", "jersey", "poplin", "twill", "chambray"];
  const warmTerms = ["wool", "knit", "fleece", "sherpa", "cashmere", "waffle knit"];
  const heavyTerms = ["puffer", "down", "parka", "heavyweight", "insulated", "quilted"];
  const hasFall = fallWinterTerms.some((t) => kws.some((k) => k.includes(t)));
  const hasSpring = springSummerTerms.some((t) => kws.some((k) => k.includes(t)));
  const season = hasFall ? "fall_winter" : hasSpring ? "spring_summer" : "";
  const isHeavy = heavyTerms.some((t) => kws.some((k) => k.includes(t)));
  const isWarm = warmTerms.some((t) => kws.some((k) => k.includes(t)));
  const isMid = midLayerTerms.some((t) => kws.some((k) => k.includes(t)));
  const isLight = lightTerms.some((t) => kws.some((k) => k.includes(t)));
  const warmth = isHeavy ? "heavy_duty" : isWarm ? "warm" : isMid ? "mid_layer" : isLight ? "light" : "";
  return { season, warmth };
}

const empty = {
  name: "",
  description: "",
  price: "" as string | number,
  image_url: "",
  affiliate_url: "",
  source_url: "",
  category: "",
  vibe_category: "",
  mood: "",
  company_name: "",
  video_url: "",
  is_active: true,
  regions: ["US"] as string[],
  additional_images: [] as string[],
  specifications: [] as SpecRow[],
  keywords: [] as string[],
  fashion_season: "" as string,
  fashion_warmth: "" as string,
  fashion_occasions: [] as string[],
};

export default function ProductForm({ editId, onDone, savedState }: Props) {
  const qc = useQueryClient();
  const { data: coreCategories = [] } = useQuery({
    queryKey: ["categories", "core"],
    queryFn: () => getCategories("core"),
  });
  const { data: vibeCategories = [] } = useQuery({
    queryKey: ["categories", "vibe"],
    queryFn: () => getCategories("vibe"),
  });
  const { data: moodCategories = [] } = useQuery({
    queryKey: ["categories", "mood"],
    queryFn: () => getCategories("mood"),
  });
  const { data: existing } = useQuery({
    queryKey: ["product", editId],
    queryFn: () => getProduct(editId!),
    enabled: !!editId,
  });
  const { data: allKeywords = [] } = useQuery({
    queryKey: ["keywords"],
    queryFn: async () => {
      const { data } = await supabase.from("keywords").select("*").order("term");
      return data || [];
    },
  });

  const [form, setForm] = useState(() => savedState?.current || empty);
  const [keywordInput, setKeywordInput] = useState("");
  const [showKeywordSuggestions, setShowKeywordSuggestions] = useState(false);
  const keywordRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (savedState) {
      savedState.current = form;
    }
  }, [form, savedState]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (keywordRef.current && !keywordRef.current.contains(e.target as Node)) {
        setShowKeywordSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (existing && editId) {
      Promise.all([
        supabase.from("product_images").select("image_url").eq("product_id", editId).order("display_order"),
        supabase.from("product_specifications").select("item_detail, specification").eq("product_id", editId).order("display_order"),
        supabase.from("product_keywords").select("keyword_id, keywords(term)").eq("product_id", editId),
      ]).then(([imgRes, specRes, kwRes]) => {
        setForm({
          name: existing.name,
          description: existing.description || "",
          price: existing.price,
          image_url: existing.image_url || "",
          affiliate_url: existing.affiliate_url,
          source_url: existing.source_url || "",
          category: existing.category,
          vibe_category: existing.vibe_category || "",
          mood: existing.mood || "",
          company_name: existing.company_name || "",
          video_url: existing.video_url || "",
          is_active: existing.is_active,
          regions: existing.regions || ["US"],
          additional_images: imgRes.data?.map((d) => d.image_url) || [],
          specifications: specRes.data?.map((s) => ({
            item_detail: s.item_detail,
            specification: s.specification,
          })) || [],
          keywords: kwRes.data?.map((k: any) => k.keywords?.term).filter(Boolean) || [],
          fashion_season: (existing as any).fashion_season || "",
          fashion_warmth: (existing as any).fashion_warmth || "",
          fashion_occasions: (existing as any).fashion_occasions || [],
        });
      });
    } else if (!editId && !savedState?.current) {
      setForm(empty);
    }
  }, [existing, editId]);

  const set = (key: string, val: any) => setForm((f: any) => ({ ...f, [key]: val }));

  const filteredKeywords = allKeywords.filter(
    (kw) =>
      kw.term.toLowerCase().includes(keywordInput.toLowerCase()) &&
      !form.keywords.includes(kw.term)
  );

  const addKeyword = async (term: string) => {
    const normalized = term.toLowerCase().trim();
    if (!normalized || form.keywords.includes(normalized)) return;
    const exists = allKeywords.find((k) => k.term === normalized);
    if (!exists) {
      await supabase.from("keywords").insert({ term: normalized });
      qc.invalidateQueries({ queryKey: ["keywords"] });
    }
    set("keywords", [...form.keywords, normalized]);
    setKeywordInput("");
    setShowKeywordSuggestions(false);
  };

  const removeKeyword = (term: string) => {
    set("keywords", form.keywords.filter((k: string) => k !== term));
  };

  const [suggestingCategories, setSuggestingCategories] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{ core: string[]; vibes: string[]; moods: string[]; keywords: string[] } | null>(null);

  const suggestCategories = async (productName: string, description: string, price: string | number) => {
    setSuggestingCategories(true);
    setAiSuggestions(null);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-categories", {
        body: { name: productName, description, price },
      });
      if (error) throw error;
      if (data?.core?.length || data?.vibes?.length || data?.moods?.length || data?.keywords?.length) {
        const suggestions = {
          core: data.core || [],
          vibes: data.vibes || [],
          moods: data.moods || [],
          keywords: data.keywords || [],
        };
        setAiSuggestions(suggestions);
        const updatedCategory = suggestions.core.length ? suggestions.core.join(",") : form.category;
        const updatedKeywords = suggestions.keywords.length
          ? [...new Set([...form.keywords, ...suggestions.keywords.map((k: string) => k.toLowerCase())])]
          : form.keywords;
        const isFashion = FASHION_SUBCATEGORIES.some((sub) => updatedCategory?.toLowerCase().includes(sub.toLowerCase()));
        const fashionUpdates: Record<string, any> = {};
        if (isFashion && updatedKeywords.length) {
          const { season, warmth } = inferFashionAttributes(updatedKeywords);
          if (season) fashionUpdates.fashion_season = season;
          if (warmth) fashionUpdates.fashion_warmth = warmth;
        }
        setForm((prev: any) => ({
          ...prev,
          category: suggestions.core.length ? suggestions.core.join(",") : prev.category,
          vibe_category: suggestions.vibes.length ? suggestions.vibes.join(",") : prev.vibe_category,
          mood: suggestions.moods.length ? suggestions.moods.join(",") : prev.mood,
          keywords: updatedKeywords,
          ...fashionUpdates,
        }));
        toast.success(`Suggested ${suggestions.core.length} categories, ${suggestions.vibes.length} vibes, ${suggestions.moods.length} moods, and ${suggestions.keywords.length} keywords`);
      } else {
        toast.info("No suggestions returned");
      }
    } catch (err) {
      console.error("Category suggestion failed:", err);
      toast.error("Category suggestion failed");
    } finally {
      setSuggestingCategories(false);
    }
  };

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const parsedPrice = typeof data.price === "string" ? parseFloat(data.price.replace(/[^0-9.]/g, "")) || "" : (data.price || "");
        setForm((prev: any) => ({
          ...prev,
          name: data.name || prev.name,
          company_name: data.company_name || prev.company_name,
          affiliate_url: data.affiliate_url || prev.affiliate_url,
          source_url: data.source_url || prev.source_url,
          image_url: data.image_url || prev.image_url,
          additional_images: Array.isArray(data.additional_images) && data.additional_images.length > 0
            ? data.additional_images.slice(0, 4)
            : prev.additional_images,
          video_url: data.video_url || prev.video_url,
          price: parsedPrice,
          description: data.description || prev.description,
          category: data.category || prev.category,
          vibe_category: data.vibe_category || prev.vibe_category,
          mood: data.mood || prev.mood,
          specifications: Array.isArray(data.specifications) && data.specifications.length > 0
            ? data.specifications
            : prev.specifications,
          is_active: typeof data.is_active === "boolean" ? data.is_active : prev.is_active,
        }));
        toast.success("Template loaded — suggesting categories...");
        const productName = data.name || "";
        const desc = data.description || "";
        if (productName) {
          suggestCategories(productName, desc, parsedPrice);
        }
      } catch {
        toast.error("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const a = document.createElement("a");
    a.href = "/product-template.json";
    a.download = "product-template.json";
    a.click();
  };

  const addImageField = () => {
    if (form.additional_images.length < 4) {
      set("additional_images", [...form.additional_images, ""]);
    }
  };

  const updateImage = (index: number, value: string) => {
    const updated = [...form.additional_images];
    updated[index] = value;
    set("additional_images", updated);
  };

  const removeImage = (index: number) => {
    set("additional_images", form.additional_images.filter((_: any, i: number) => i !== index));
  };

  const addSpecRow = () => {
    set("specifications", [...form.specifications, { item_detail: "", specification: "" }]);
  };

  const updateSpec = (index: number, field: keyof SpecRow, value: string) => {
    const updated = [...form.specifications];
    updated[index] = { ...updated[index], [field]: value };
    set("specifications", updated);
  };

  const removeSpec = (index: number) => {
    set("specifications", form.specifications.filter((_: any, i: number) => i !== index));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!editId) {
        const { data: dupes } = await supabase
          .from("products")
          .select("id, is_active")
          .ilike("name", form.name.trim())
          .limit(1);
        if (dupes && dupes.length > 0) {
          const isDraft = !dupes[0].is_active;
          throw new Error(
            isDraft
              ? `A draft product named "${form.name.trim()}" already exists. Review existing drafts before adding a new one.`
              : `A product named "${form.name.trim()}" already exists.`
          );
        }
      }

      const isFashion = FASHION_SUBCATEGORIES.some((sub) => form.category?.toLowerCase().includes(sub.toLowerCase()));
      const payload = {
        name: form.name,
        description: form.description,
        price: Number(form.price) || 0,
        image_url: form.image_url,
        affiliate_url: form.affiliate_url,
        source_url: form.source_url,
        category: form.category,
        company_name: form.company_name,
        is_active: form.is_active,
        vibe_category: form.vibe_category || null,
        mood: form.mood || null,
        video_url: form.video_url || null,
        regions: form.regions.length > 0 ? form.regions : ["US"],
        slug: generateSlug(form.name),
        fashion_season: isFashion ? form.fashion_season || null : null,
        fashion_warmth: isFashion ? form.fashion_warmth || null : null,
        fashion_occasions: isFashion ? form.fashion_occasions : [],
      };

      let productId = editId;

      if (editId) {
        const { error } = await supabase.from("products").update(payload).eq("id", editId);
        if (error) throw error;
        await Promise.all([
          supabase.from("product_images").delete().eq("product_id", editId),
          supabase.from("product_specifications").delete().eq("product_id", editId),
          supabase.from("product_keywords").delete().eq("product_id", editId),
        ]);
      } else {
        const { data, error } = await supabase.from("products").insert([payload]).select("id").single();
        if (error) throw error;
        productId = data.id;
      }

      const validImages = form.additional_images.filter((url: string) => url.trim());
      if (validImages.length > 0 && productId) {
        const { error } = await supabase.from("product_images").insert(
          validImages.map((url: string, i: number) => ({
            product_id: productId!,
            image_url: url.trim(),
            display_order: i + 1,
          }))
        );
        if (error) throw error;
      }

      const validSpecs = form.specifications.filter(
        (s: SpecRow) => s.item_detail.trim() && s.specification.trim()
      );
      if (validSpecs.length > 0 && productId) {
        const { error } = await supabase.from("product_specifications").insert(
          validSpecs.map((s: SpecRow, i: number) => ({
            product_id: productId!,
            item_detail: s.item_detail.trim(),
            specification: s.specification.trim(),
            display_order: i + 1,
          }))
        );
        if (error) throw error;
      }

      if (form.keywords.length > 0 && productId) {
        for (const term of form.keywords) {
          let { data: kw } = await supabase.from("keywords").select("id").eq("term", term).single();
          if (!kw) {
            const { data: newKw } = await supabase.from("keywords").insert({ term }).select("id").single();
            kw = newKw;
          }
          if (kw) {
            await supabase.from("product_keywords").insert({ product_id: productId!, keyword_id: kw.id });
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(editId ? "Product updated" : "Product added");
      if (!editId) {
        setForm(empty);
        if (savedState) savedState.current = null;
      }
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  const isFashionProduct = FASHION_SUBCATEGORIES.some(
    (sub) => form.category?.toLowerCase().includes(sub.toLowerCase())
  );

  const preview: Product = {
    id: "preview",
    name: form.name || "Product Name",
    description: form.description || "Product description will appear here",
    price: Number(form.price) || 0,
    image_url: form.image_url || null,
    affiliate_url: form.affiliate_url || "#",
    source_url: form.source_url || "",
    category: form.category || "Category",
    vibe_category: form.vibe_category || null,
    mood: form.mood || null,
    company_name: form.company_name || null,
    is_active: form.is_active,
    video_url: form.video_url || null,
    regions: form.regions || ["US"],
    slug: generateSlug(form.name || "product-name"),
    page_error: false,
    page_error_detail: null,
    check_failure_count: 0,
    last_checked_at: null,
    date_added: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    fashion_season: form.fashion_season || null,
    fashion_warmth: form.fashion_warmth || null,
    fashion_occasions: form.fashion_occasions || [],
    status: "active",
    report_count: 0,
    last_click_at: null,
    last_verified_at: null,
    last_status_code: null,
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
        {/* Template upload/download */}
        <div className="flex items-center gap-2 pb-2 border-b border-border mb-2">
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Download Template
          </Button>
          <label>
            <input type="file" accept=".json" onChange={handleTemplateUpload} className="hidden" />
            <Button type="button" variant="outline" size="sm" className="gap-1.5 cursor-pointer" asChild>
              <span><Upload className="h-3.5 w-3.5" /> Upload Template</span>
            </Button>
          </label>
        </div>
        <div>
          <Label>Product Name</Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div>
          <Label>Company Name</Label>
          <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
        </div>
        <div>
          <Label>Affiliate Link</Label>
          <Input value={form.affiliate_url} onChange={(e) => set("affiliate_url", e.target.value)} required placeholder="https://..." />
        </div>
        <div>
          <Label>Source Product Page URL (required, admin only)</Label>
          <Input value={form.source_url} onChange={(e) => set("source_url", e.target.value)} required placeholder="https://retailer.com/product/..." />
          <p className="mt-1 text-xs text-muted-foreground">Original product page URL for link validation</p>
        </div>
        <div>
          <Label>Main Image URL</Label>
          <Input value={form.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="https://..." />
        </div>

        {/* AI suggestions display - shown inline after suggest */}
        {aiSuggestions && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">✨ AI Suggestions Applied</p>
            {aiSuggestions.keywords.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Keywords:</p>
                <div className="flex flex-wrap gap-1.5">
                  {aiSuggestions.keywords.map((k) => (
                    <span key={k} className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{k}</span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Categories, vibes, moods, and keywords have been auto-selected. Adjust as needed.</p>
          </div>
        )}
        {/* Additional images */}
        <div>
          <div className="flex items-center justify-between">
            <Label>Additional Images ({form.additional_images.length}/4)</Label>
            <Button type="button" variant="outline" size="sm" onClick={addImageField} disabled={form.additional_images.length >= 4}>
              + Add Image
            </Button>
          </div>
          <div className="mt-2 space-y-2">
            {form.additional_images.map((url: string, i: number) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => updateImage(i, e.target.value)}
                  placeholder="https://..."
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeImage(i)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        {/* Video URL */}
        <div>
          <Label>Video URL (optional)</Label>
          <Input value={form.video_url} onChange={(e) => set("video_url", e.target.value)} placeholder="https://..." />
          <p className="mt-1 text-xs text-muted-foreground">Direct link to an MP4 video file</p>
        </div>

        <div>
          <Label>Price</Label>
          <Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} required placeholder="29.99" />
        </div>
        <div>
          <Label>Description</Label>
          <RichTextEditor value={form.description} onChange={(html) => set("description", html)} />
        </div>
        <div>
          <Label>Category (Core Lifestyle — up to 5) {suggestingCategories && <span className="text-xs text-muted-foreground animate-pulse ml-2">✨ AI suggesting...</span>}</Label>
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border p-3 max-h-48 overflow-y-auto">
            {coreCategories.filter((c) => !!c.parent_slug).map((c) => {
              const selected = (form.category || "").split(",").filter(Boolean);
              const isChecked = selected.includes(c.name);
              const atLimit = selected.length >= 5 && !isChecked;
              return (
                <label key={c.id} className={`flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 ${atLimit ? "opacity-50 cursor-not-allowed" : ""}`}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={atLimit}
                    onChange={() => {
                      const updated = isChecked
                        ? selected.filter((v: string) => v !== c.name)
                        : [...selected, c.name];
                      set("category", updated.join(","));
                    }}
                    className="rounded"
                  />
                  {c.icon} {c.name}
                </label>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={suggestingCategories || !form.name}
            onClick={() => suggestCategories(form.name, form.description || "", form.price)}
            className="mt-2 w-full"
          >
            {suggestingCategories ? <span className="animate-pulse">✨ Analyzing...</span> : <>✨ Suggest Categories</>}
          </Button>
          {aiSuggestions && aiSuggestions.core.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {aiSuggestions.core.map((c) => (
                <span key={c} className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{c}</span>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Label>Vibes (Optional — select multiple)</Label>
            <Dialog>
              <DialogTrigger asChild>
                <button type="button" className="inline-flex items-center justify-center rounded-full h-5 w-5 bg-muted hover:bg-muted/80 text-muted-foreground transition-colors">
                  <Info className="h-3 w-3" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Vibe Categories Guide</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  {vibeCategories.map((c) => (
                    <div key={c.id} className="flex gap-2">
                      <span className="text-lg shrink-0">{c.icon}</span>
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border p-3 max-h-48 overflow-y-auto">
            {vibeCategories.map((c) => {
              const selected = (form.vibe_category || "").split(",").filter(Boolean);
              const isChecked = selected.includes(c.name);
              return (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      const updated = isChecked
                        ? selected.filter((v: string) => v !== c.name)
                        : [...selected, c.name];
                      set("vibe_category", updated.join(","));
                    }}
                    className="rounded"
                  />
                  {c.icon} {c.name}
                </label>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={suggestingCategories || !form.name}
            onClick={() => suggestCategories(form.name, form.description || "", form.price)}
            className="mt-2 w-full"
          >
            {suggestingCategories ? <span className="animate-pulse">✨ Analyzing...</span> : <>✨ Suggest Vibes</>}
          </Button>
          {aiSuggestions && aiSuggestions.vibes.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {aiSuggestions.vibes.map((v) => (
                <span key={v} className="inline-flex items-center rounded-full bg-accent/50 px-2.5 py-0.5 text-xs font-medium text-accent-foreground">{v}</span>
              ))}
            </div>
          )}
        </div>
        {/* Moods */}
        <div>
          <div className="flex items-center gap-2">
            <Label>Moods (Optional — select multiple)</Label>
            <Dialog>
              <DialogTrigger asChild>
                <button type="button" className="inline-flex items-center justify-center rounded-full h-5 w-5 bg-muted hover:bg-muted/80 text-muted-foreground transition-colors">
                  <Info className="h-3 w-3" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Mood Categories Guide</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  {moodCategories.map((c) => (
                    <div key={c.id} className="flex gap-2">
                      <span className="text-lg shrink-0">{c.icon}</span>
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border p-3 max-h-48 overflow-y-auto">
            {moodCategories.map((c) => {
              const selected = (form.mood || "").split(",").filter(Boolean);
              const isChecked = selected.includes(c.name);
              return (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      const updated = isChecked
                        ? selected.filter((v: string) => v !== c.name)
                        : [...selected, c.name];
                      set("mood", updated.join(","));
                    }}
                    className="rounded"
                  />
                  {c.icon} {c.name}
                </label>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={suggestingCategories || !form.name}
            onClick={() => suggestCategories(form.name, form.description || "", form.price)}
            className="mt-2 w-full"
          >
            {suggestingCategories ? <span className="animate-pulse">✨ Analyzing...</span> : <>✨ Suggest Moods</>}
          </Button>
          {aiSuggestions && aiSuggestions.moods.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {aiSuggestions.moods.map((m) => (
                <span key={m} className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">{m}</span>
              ))}
            </div>
          )}
        </div>
        <div ref={keywordRef}>
          <div className="flex items-center justify-between">
            <Label>Keywords (for SEO & AI Discovery)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={suggestingCategories || (!form.name && !form.company_name)}
              onClick={async () => {
                setSuggestingCategories(true);
                try {
                  const { data, error } = await supabase.functions.invoke("suggest-categories", {
                    body: { name: form.name, description: form.description, price: form.price },
                  });
                  if (error) throw error;
                  const suggested = (data?.keywords || []).map((k: string) => k.toLowerCase().trim()).filter(Boolean);
                  if (suggested.length) {
                    const updatedKws = [...new Set([...form.keywords, ...suggested])];
                    const isFashion = FASHION_SUBCATEGORIES.some((sub) => form.category?.toLowerCase().includes(sub.toLowerCase()));
                    const fashionUpdates: Record<string, any> = {};
                    if (isFashion) {
                      const { season, warmth } = inferFashionAttributes(updatedKws);
                      if (season) fashionUpdates.fashion_season = season;
                      if (warmth) fashionUpdates.fashion_warmth = warmth;
                    }
                    setForm((prev: any) => ({
                      ...prev,
                      keywords: updatedKws,
                      ...fashionUpdates,
                    }));
                    toast.success(`Added ${suggested.length} keyword suggestions`);
                  } else {
                    toast.info("No keyword suggestions returned");
                  }
                } catch (err) {
                  console.error("Keyword suggestion failed:", err);
                  toast.error("Keyword suggestion failed");
                } finally {
                  setSuggestingCategories(false);
                }
              }}
              className="gap-1 text-xs"
            >
              {suggestingCategories ? "Suggesting..." : "✨ Suggest Keywords"}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 min-h-[32px] rounded-lg border p-2">
            {form.keywords.map((kw: string) => (
              <span key={kw} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                {kw}
                <button type="button" onClick={() => removeKeyword(kw)} className="ml-0.5 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="relative mt-1">
            <Input
              value={keywordInput}
              onChange={(e) => { setKeywordInput(e.target.value); setShowKeywordSuggestions(true); }}
              onFocus={() => setShowKeywordSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && keywordInput.trim()) {
                  e.preventDefault();
                  addKeyword(keywordInput);
                }
              }}
              placeholder="Type to search or add keywords..."
              className="text-sm"
            />
            {showKeywordSuggestions && keywordInput && filteredKeywords.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
                {filteredKeywords.slice(0, 15).map((kw) => (
                  <button
                    key={kw.id}
                    type="button"
                    onClick={() => addKeyword(kw.term)}
                    className="w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
                  >
                    {kw.term}
                  </button>
                ))}
                {!allKeywords.find((k) => k.term === keywordInput.toLowerCase().trim()) && (
                  <button
                    type="button"
                    onClick={() => addKeyword(keywordInput)}
                    className="w-full rounded px-2 py-1 text-left text-sm text-primary hover:bg-muted"
                  >
                    + Create "{keywordInput.trim()}"
                  </button>
                )}
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Press Enter to add custom keywords. Use ✨ Suggest to auto-generate from product name & description.</p>
        </div>

        {/* Style Attributes — fashion only */}
        {isFashionProduct && (
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Label className="text-blue-700 dark:text-blue-300 font-medium">Style Attributes</Label>
              <span className="text-xs text-blue-500 dark:text-blue-400">
                Fashion category detected — inferred from keywords where possible
              </span>
            </div>
            {/* Season */}
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Season</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "spring_summer", label: "Spring / Summer" },
                  { value: "fall_winter", label: "Fall / Winter" },
                  { value: "all_season", label: "All season" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set("fashion_season", form.fashion_season === value ? "" : value)}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      form.fashion_season === value
                        ? "bg-blue-100 dark:bg-blue-900 border-blue-500 text-blue-800 dark:text-blue-200"
                        : "bg-background border-border text-muted-foreground hover:border-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Warmth */}
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Warmth</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "light", label: "Light" },
                  { value: "mid_layer", label: "Mid-layer" },
                  { value: "warm", label: "Warm" },
                  { value: "heavy_duty", label: "Heavy duty" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set("fashion_warmth", form.fashion_warmth === value ? "" : value)}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      form.fashion_warmth === value
                        ? "bg-amber-100 dark:bg-amber-950 border-amber-500 text-amber-800 dark:text-amber-200"
                        : "bg-background border-border text-muted-foreground hover:border-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Occasion */}
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Occasion</Label>
              <div className="flex flex-wrap gap-2">
                {["Everyday", "Work", "Evening", "Active", "Outdoor"].map((occ) => {
                  const val = occ.toLowerCase();
                  const selected = form.fashion_occasions.includes(val);
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() =>
                        set(
                          "fashion_occasions",
                          selected
                            ? form.fashion_occasions.filter((o: string) => o !== val)
                            : [...form.fashion_occasions, val]
                        )
                      }
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        selected
                          ? "bg-green-100 dark:bg-green-950 border-green-500 text-green-800 dark:text-green-200"
                          : "bg-background border-border text-muted-foreground hover:border-foreground"
                      }`}
                    >
                      {occ}
                    </button>
                  );
                })}
              </div>
            </div>
            {(form.fashion_season || form.fashion_warmth) && (
              <p className="text-xs text-blue-500 dark:text-blue-400">
                Season and warmth were inferred from keywords. Select to override.
              </p>
            )}
          </div>
        )}

        {/* Specifications */}
        <div>
          <div className="flex items-center justify-between">
            <Label>Specifications (optional)</Label>
            <Button type="button" variant="outline" size="sm" onClick={addSpecRow} className="gap-1">
              <Plus className="h-3 w-3" /> Add Spec
            </Button>
          </div>
          <div className="mt-2 space-y-2">
            {form.specifications.map((spec: SpecRow, i: number) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={spec.item_detail}
                  onChange={(e) => updateSpec(i, "item_detail", e.target.value)}
                  placeholder="Item Detail (e.g. Material)"
                  className="w-2/5"
                />
                <Input
                  value={spec.specification}
                  onChange={(e) => updateSpec(i, "specification", e.target.value)}
                  placeholder="Specification (e.g. 100% Cotton)"
                  className="w-3/5"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeSpec(i)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Region Availability */}
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
                        : form.regions.filter((x: string) => x !== r.code);
                      set("regions", next.length > 0 ? next : ["US"]);
                    }}
                    className="rounded"
                  />
                  {r.label}
                </label>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Select regions where this product ships to. Default: US only.</p>
        </div>

        <div className="flex items-center gap-3">
          <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
          <Label>{form.is_active ? "Active" : "Draft"}</Label>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" disabled={mutation.isPending} className="rounded-full">
            {editId ? "Update Product" : "Add Product"}
          </Button>
          {editId && form.is_active && (
            <Button type="button" variant="outline" className="gap-1.5 rounded-full" asChild>
              <a href={`/product/${editId}`} target="_blank" rel="noopener noreferrer">
                View Product Page <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          {!editId && (
            <Button type="button" variant="outline" onClick={() => { setForm(empty); if (savedState) savedState.current = null; }} className="rounded-full">
              Clear Fields
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onDone} className="rounded-full">Cancel</Button>
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
