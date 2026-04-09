import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AutomatedLinkCheckConfig() {
  const [cronActive, setCronActive] = useState(true);
  const [togglingCron, setTogglingCron] = useState(false);
  const [showCronConfirm, setShowCronConfirm] = useState(false);

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
            Background job that verifies product source URLs are still active. Products with 3 consecutive failures are automatically flagged.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Enable automated checks</p>
              <p className="text-xs text-muted-foreground">Runs every 6 hours in batches of 50 products</p>
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
              <span className="text-muted-foreground">Frequency</span>
              <span className="font-medium">Every 6 hours</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Auto-deactivation threshold</span>
              <span className="font-medium">3 consecutive failures</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showCronConfirm} onOpenChange={setShowCronConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable automated link checker?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the background job that checks product links every 6 hours. Broken links won't be detected automatically until you re-enable it.
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
