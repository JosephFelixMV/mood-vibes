import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const AI_CONFIG_KEYS = [
  {
    key: "ai_weekly_prompt_limit",
    label: "Weekly Prompt Limit",
    help: "Maximum number of AI searches each visitor can make per rolling 7-day window. Cached/duplicate prompts don't count against this limit.",
    type: "number",
    min: 1,
    max: 100,
  },
  {
    key: "ai_cache_duration_hours",
    label: "Cache Duration (hours)",
    help: "How long AI search results are cached. If another user searches the same prompt within this window, cached results are returned instantly without using AI credits.",
    type: "number",
    min: 1,
    max: 168,
  },
  {
    key: "ai_max_results",
    label: "Max Results per Search",
    help: "Maximum number of product matches the AI can return per search. Higher values give users more to browse but increase AI token usage.",
    type: "number",
    min: 3,
    max: 50,
  },
];

export default function AIDiscoverConfig() {
  const qc = useQueryClient();
  const [edited, setEdited] = useState<Record<string, string>>({});

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["site-config-ai"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("*")
        .in("key", AI_CONFIG_KEYS.map((k) => k.key));
      if (error) throw error;
      return data;
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
      qc.invalidateQueries({ queryKey: ["site-config-ai"] });
      qc.invalidateQueries({ queryKey: ["site-config"] });
      setEdited({});
      toast.success("AI Discover configuration saved");
    },
    onError: (err: any) => toast.error("Failed to save: " + err.message),
  });

  const getValue = (key: string) => {
    if (key in edited) return edited[key];
    return configs.find((c) => c.key === key)?.value ?? "";
  };

  const hasChanges = Object.keys(edited).length > 0;

  const handleSave = () => {
    const updates = Object.entries(edited).map(([key, value]) => ({ key, value }));
    if (updates.length > 0) saveMut.mutate(updates);
  };

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Discover Settings
        </CardTitle>
        <CardDescription>
          Control usage limits and performance for the AI-powered product discovery page. These settings help manage AI costs and prevent abuse while keeping the experience smooth for genuine visitors.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {AI_CONFIG_KEYS.map((cfg) => (
          <div key={cfg.key} className="space-y-1.5">
            <label className="text-sm font-medium">{cfg.label}</label>
            <p className="text-xs text-muted-foreground">{cfg.help}</p>
            <Input
              type={cfg.type}
              min={cfg.min}
              max={cfg.max}
              value={getValue(cfg.key)}
              onChange={(e) => setEdited((prev) => ({ ...prev, [cfg.key]: e.target.value }))}
              className="max-w-[200px]"
            />
          </div>
        ))}

        {hasChanges && (
          <Button onClick={handleSave} disabled={saveMut.isPending} className="gap-1.5">
            {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save AI Settings
          </Button>
        )}

        <div className="rounded-md border p-3 space-y-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground text-sm">How it works</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Visitors describe what they're looking for in natural language</li>
            <li>Products are pre-filtered by keyword relevance, then ranked by AI (gemini-2.5-flash-lite)</li>
            <li>Rate limiting is per-IP on a rolling 7-day window — cached results don't count against the limit</li>
            <li>A burst detector pauses users who send 4+ searches in 2 minutes (10-minute cooldown)</li>
            <li>All prompts are sanitized and checked for profanity before processing</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
