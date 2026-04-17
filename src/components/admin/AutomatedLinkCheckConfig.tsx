import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const LINK_CONFIG_KEYS = [
  {
    key: "link_check_batch_size",
    label: "Batch Size",
    help: "Number of products checked per scheduled run. Higher values check more products but take longer and increase vendor request volume.",
    type: "number",
    min: 5,
    max: 200,
  },
  {
    key: "link_check_deactivation_threshold",
    label: "Auto-deactivation Threshold",
    help: "Number of consecutive check failures before a product is automatically deactivated. A product's failure count resets to zero when it passes a check.",
    type: "number",
    min: 1,
    max: 20,
  },
  {
    key: "link_check_vendor_cap",
    label: "Per-Vendor Cap",
    help: "Maximum number of products from the same vendor (domain) that will be checked in a single batch run. Prevents hammering one site with too many requests. Additional products from that vendor are skipped and re-queued for the next run.",
    type: "number",
    min: 1,
    max: 50,
  },
  {
    key: "link_check_min_delay_ms",
    label: "Min Delay Between Requests (ms)",
    help: "Minimum wait time in milliseconds between requests. The actual delay is randomized between the min and max values to avoid pattern detection by vendor CDNs.",
    type: "number",
    min: 500,
    max: 10000,
  },
  {
    key: "link_check_max_delay_ms",
    label: "Max Delay Between Requests (ms)",
    help: "Maximum wait time in milliseconds between requests. Together with the min delay, this creates a jitter window that makes request timing appear more natural.",
    type: "number",
    min: 1000,
    max: 15000,
  },
];

export default function AutomatedLinkCheckConfig() {
  const qc = useQueryClient();
  const [cronActive, setCronActive] = useState(true);
  const [togglingCron, setTogglingCron] = useState(false);
  const [showCronConfirm, setShowCronConfirm] = useState(false);
  const [edited, setEdited] = useState<Record<string, string>>({});

  useQuery({
    queryKey: ["cron-job-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("toggle-cron-job", { method: "GET" });
      if (error) throw error;
      setCronActive(data.active);
      return data.active;
    },
  });

  const { data: lastBatchCheck } = useQuery({
    queryKey: ["last-batch-check"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("last_checked_at")
        .not("last_checked_at", "is", null)
        .order("last_checked_at", { ascending: false })
        .limit(1);
      return data?.[0]?.last_checked_at ?? null;
    },
  });

  const { data: configs = [] } = useQuery({
    queryKey: ["site-config-link-check"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("*")
        .in("key", LINK_CONFIG_KEYS.map((k) => k.key));
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
      qc.invalidateQueries({ queryKey: ["site-config-link-check"] });
      qc.invalidateQueries({ queryKey: ["site-config"] });
      setEdited({});
      toast.success("Link checker configuration saved");
    },
    onError: (err: any) => toast.error("Failed to save: " + err.message),
  });

  const getValue = (key: string) => {
    if (key in edited) return edited[key];
    return configs.find((c) => c.key === key)?.value ?? "";
  };

  const hasChanges = Object.keys(edited).length > 0;

  const handleSaveConfig = () => {
    const updates = Object.entries(edited).map(([key, value]) => ({ key, value }));
    if (updates.length > 0) saveMut.mutate(updates);
  };

  const handleToggleCron = async (enable: boolean) => {
    if (!enable) {
      setShowCronConfirm(true);
      return;
    }
    await executeCronToggle(true);
  };

  const executeCronToggle = async (enable: boolean) => {
    setShowCronConfirm(false);
    setTogglingCron(true);
    try {
      const { data, error } = await supabase.functions.invoke("toggle-cron-job", {
        body: { enable },
      });
      if (error) throw error;
      const isActive = data?.active ?? enable;
      setCronActive(isActive);
      toast.success(`Batch link checker ${isActive ? "enabled" : "disabled"}`);
    } catch (err: any) {
      toast.error("Failed to toggle: " + err.message);
    } finally {
      setTogglingCron(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Automated Link Checker
          </CardTitle>
          <CardDescription>
            Periodically verifies that product source URLs are still live and haven't been redirected or removed. Protects your catalog from broken links that would lead visitors to dead pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Enable automated checks</p>
              <p className="text-xs text-muted-foreground">Runs on a scheduled cron job (every 6 hours by default)</p>
            </div>
            <div className="flex items-center gap-2">
              {togglingCron && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch
                checked={cronActive}
                onCheckedChange={handleToggleCron}
                disabled={togglingCron}
              />
              <Badge variant={cronActive ? "default" : "secondary"} className="text-xs">
                {cronActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          {/* Configurable fields */}
          {LINK_CONFIG_KEYS.map((cfg) => (
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
            <Button onClick={handleSaveConfig} disabled={saveMut.isPending} className="gap-1.5">
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Link Checker Settings
            </Button>
          )}

          {/* Stats */}
          <div className="rounded-md border p-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last batch check</span>
              <span className="font-medium">
                {lastBatchCheck
                  ? format(new Date(lastBatchCheck), "MMM d, yyyy h:mm a")
                  : "No checks recorded yet"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Schedule</span>
              <span className="font-medium">Every 6 hours (cron)</span>
            </div>
          </div>

          {/* How it works */}
          <div className="rounded-md border p-3 space-y-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground text-sm">How it works</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Selection order:</strong> Products are checked by <code>last_verified_at</code> ascending — the longest-unverified products are prioritized. Never-checked products are processed first.</li>
              <li><strong>What it checks:</strong> The checker fetches each product's source URL using a full GET request and verifies it returns a valid page (not a 404/410, not redirected to the homepage, not redirected to a different domain).</li>
              <li><strong>Per-vendor cap:</strong> No single vendor (domain) will be checked more than the configured cap per batch run, preventing vendor overload. Excess products are re-queued.</li>
              <li><strong>Randomized timing:</strong> Delays between requests are randomized within a configurable jitter window (default 2–5s). A plausible <code>Referer</code> header simulates organic traffic.</li>
              <li><strong>429 backoff:</strong> If a vendor returns HTTP 429 (rate limit), that vendor is immediately blocked for the remainder of the batch run. All remaining products from that vendor are skipped and re-queued.</li>
              <li><strong>Soft-block detection:</strong> Response bodies are scanned for CAPTCHAs, "access denied" text, and suspiciously small pages (&lt;1.5KB). These generate warnings without counting toward deactivation.</li>
              <li><strong>Status transitions:</strong> Failed checks increment a counter. At the threshold, active products become <strong>flagged</strong>. Flagged products that fail again become <strong>unpublished</strong>. A successful check resets the counter.</li>
              <li><strong>Click-time validation:</strong> When users click "Buy Now", a non-blocking HEAD request validates the affiliate URL in the background, providing real-time broken link detection.</li>
              <li><strong>User reports:</strong> Users can report broken links. After the configured threshold of unique reports (default 3), products are automatically flagged for admin review.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showCronConfirm} onOpenChange={setShowCronConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable automated link checker?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the background job that checks product links. Broken links won't be detected automatically until you re-enable it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => executeCronToggle(false)}>Disable</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
