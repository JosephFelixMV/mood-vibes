import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Save, Loader2, ExternalLink, BarChart3, MousePointer, Search, Globe, FileText, Shield } from "lucide-react";
import { toast } from "sonner";
import CategoryVibeManager from "./CategoryVibeManager";

interface ConfigItem {
  id: string;
  key: string;
  value: string;
  label: string;
}

const CONFIG_SECTIONS = [
  {
    title: "Analytics & Tracking",
    icon: BarChart3,
    description: "Connect your analytics and user behavior tracking tools.",
    keys: ["google_analytics_id", "hotjar_id"],
    helpTexts: {
      google_analytics_id: "Enter your Google Analytics 4 Measurement ID (e.g., G-XXXXXXXXXX). Find it in Google Analytics → Admin → Data Streams.",
      hotjar_id: "Enter your Hotjar Site ID (numeric). Find it in Hotjar → Settings → Sites & Organizations.",
    },
  },
  {
    title: "SEO & Metadata",
    icon: Search,
    description: "Configure default SEO metadata applied site-wide when pages don't set their own.",
    keys: ["meta_title", "meta_description", "meta_keywords", "og_image", "canonical_base_url"],
    helpTexts: {
      meta_title: "Default page title (max 60 chars). Shown in browser tabs and search results.",
      meta_description: "Default meta description (max 160 chars). Shown in search result snippets.",
      meta_keywords: "Comma-separated keywords for SEO (e.g., gifts, unique finds, curated products).",
      og_image: "Full URL to the default Open Graph image for social sharing (1200×630px recommended).",
      canonical_base_url: "Your production domain (e.g., https://yourdomain.com). Used for canonical URLs and sitemaps.",
    },
  },
  {
    title: "Crawling & Indexing",
    icon: Globe,
    description: "Control how search engines discover and index your site.",
    keys: ["robots_txt_custom"],
    helpTexts: {
      robots_txt_custom: "Add custom robots.txt rules (one per line). These are appended to the default rules.",
    },
  },
];

const RECOMMENDATIONS = [
  {
    name: "Google Search Console",
    description: "Monitor your site's search performance, submit sitemaps, and fix indexing issues.",
    url: "https://search.google.com/search-console",
    icon: Search,
    category: "SEO",
  },
  {
    name: "Microsoft Clarity",
    description: "Free heatmaps and session recordings. Great alternative/complement to Hotjar.",
    url: "https://clarity.microsoft.com",
    icon: MousePointer,
    category: "Analytics",
  },
  {
    name: "Schema Markup / JSON-LD",
    description: "Add structured data to product pages for rich search results (star ratings, price, availability).",
    url: "https://developers.google.com/search/docs/appearance/structured-data",
    icon: FileText,
    category: "SEO",
  },
  {
    name: "Google PageSpeed Insights",
    description: "Analyze page performance and Core Web Vitals. Critical for SEO rankings.",
    url: "https://pagespeed.web.dev",
    icon: BarChart3,
    category: "Performance",
  },
  {
    name: "Cloudflare Web Analytics",
    description: "Privacy-first, free analytics that doesn't use cookies. Great if you're already on Cloudflare.",
    url: "https://www.cloudflare.com/web-analytics/",
    icon: Shield,
    category: "Analytics",
  },
];

export default function SiteConfiguration() {
  const qc = useQueryClient();
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["site-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("*")
        .order("key");
      if (error) throw error;
      return data as ConfigItem[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (updates: { key: string; value: string }[]) => {
      for (const u of updates) {
        const { error } = await supabase
          .from("site_config")
          .update({ value: u.value })
          .eq("key", u.key);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["site-config"] });
      setEditedValues({});
      toast.success("Configuration saved");
    },
    onError: (err: any) => {
      toast.error("Failed to save: " + err.message);
    },
  });

  const getConfigValue = (key: string) => {
    if (key in editedValues) return editedValues[key];
    return configs.find((c) => c.key === key)?.value ?? "";
  };

  const handleChange = (key: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
  };

  const hasChanges = Object.keys(editedValues).length > 0;

  const handleSave = () => {
    const updates = Object.entries(editedValues).map(([key, value]) => ({ key, value }));
    if (updates.length > 0) saveMut.mutate(updates);
  };

  if (isLoading) {
    return <div className="py-10 text-center text-muted-foreground">Loading configuration…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Save bar */}
      {hasChanges && (
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg border bg-card p-3 shadow-sm">
          <span className="text-sm font-medium text-muted-foreground">
            You have unsaved changes
          </span>
          <Button onClick={handleSave} disabled={saveMut.isPending} className="gap-1.5">
            {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      )}

      {/* Category & Vibe Manager */}
      <CategoryVibeManager />

      {/* Config sections */}
      {CONFIG_SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <section.icon className="h-5 w-5 text-primary" />
              {section.title}
            </CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.keys.map((key) => {
              const isTextarea = key === "robots_txt_custom" || key === "meta_description";
              const helpText = section.helpTexts[key as keyof typeof section.helpTexts];
              return (
                <div key={key} className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {configs.find((c) => c.key === key)?.label || key}
                  </label>
                  {helpText && (
                    <p className="text-xs text-muted-foreground">{helpText}</p>
                  )}
                  {isTextarea ? (
                    <Textarea
                      value={getConfigValue(key)}
                      onChange={(e) => handleChange(key, e.target.value)}
                      placeholder={`Enter ${key.replace(/_/g, " ")}…`}
                      rows={3}
                    />
                  ) : (
                    <Input
                      value={getConfigValue(key)}
                      onChange={(e) => handleChange(key, e.target.value)}
                      placeholder={`Enter ${key.replace(/_/g, " ")}…`}
                    />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            💡 Recommended Tools & Configurations
          </CardTitle>
          <CardDescription>
            Additional tools to improve your site's analytics, SEO, and performance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {RECOMMENDATIONS.map((rec) => (
              <a
                key={rec.name}
                href={rec.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-2 rounded-lg border p-4 transition-colors hover:border-primary/50 hover:bg-accent/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <rec.icon className="h-4 w-4 text-primary" />
                    <span className="font-medium">{rec.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{rec.category}</Badge>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{rec.description}</p>
              </a>
            ))}
          </div>

          <Separator className="my-4" />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Other considerations:</p>
            <ul className="list-disc space-y-1 pl-5 text-xs">
              <li><strong>Sitemap.xml</strong> — Auto-generate and submit to Google Search Console for better crawling</li>
              <li><strong>Open Graph tags</strong> — Already set per-product via share buttons; defaults configured above</li>
              <li><strong>Favicon & PWA manifest</strong> — Add app icons and a web manifest for mobile installs</li>
              <li><strong>Content Security Policy (CSP)</strong> — Configure via Cloudflare headers for extra security</li>
              <li><strong>Cookie consent banner</strong> — Required if using GA/Hotjar in GDPR regions</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
