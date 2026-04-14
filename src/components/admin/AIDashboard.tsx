import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Activity, Search, Shield, Sparkles, Upload } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

type SortKey = "created_at" | "result_count";

function StatCard({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: string | number; accent?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

export default function AIDashboard() {
  const [sortBy, setSortBy] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFlagged, setShowFlagged] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSeedBrandLookup = async (file: File) => {
    setSeeding(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const brands = json.brands || json;
      if (!Array.isArray(brands)) throw new Error("Expected a 'brands' array in JSON");

      const { data, error } = await supabase.functions.invoke("seed-brand-lookup", {
        body: { brands },
      });
      if (error) throw error;
      toast({ title: "Brand lookup seeded", description: `${data.inserted} brands processed` });
    } catch (e: any) {
      toast({ title: "Seed failed", description: e.message, variant: "destructive" });
    } finally {
      setSeeding(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ["ai-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const today = requests.filter((r) => r.created_at >= todayStart);
    const thisWeek = requests.filter((r) => r.created_at >= weekStart);
    const flagged = requests.filter((r) => r.flagged);
    const uniqueIps = new Set(requests.map((r) => r.ip_hash));
    const avgResults = requests.length > 0
      ? (requests.reduce((sum, r) => sum + (r.result_count || 0), 0) / requests.length).toFixed(1)
      : "0";

    return { total: requests.length, today: today.length, thisWeek: thisWeek.length, flagged: flagged.length, uniqueIps: uniqueIps.size, avgResults };
  }, [requests]);

  const filtered = useMemo(() => {
    let list = showFlagged ? requests.filter((r) => r.flagged) : requests;
    list = [...list].sort((a, b) => {
      const aVal = sortBy === "created_at" ? new Date(a.created_at).getTime() : (a.result_count || 0);
      const bVal = sortBy === "created_at" ? new Date(b.created_at).getTime() : (b.result_count || 0);
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
    return list;
  }, [requests, showFlagged, sortBy, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(key); setSortDir("desc"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> AI Discover Analytics
        </h2>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleSeedBrandLookup(file);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={seeding}
            onClick={() => fileInputRef.current?.click()}
            className="gap-1"
          >
            {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Seed Brand Lookup
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={<Activity className="h-4 w-4" />} label="Total Requests" value={stats.total} />
        <StatCard icon={<Search className="h-4 w-4" />} label="Today" value={stats.today} />
        <StatCard icon={<Activity className="h-4 w-4" />} label="This Week" value={stats.thisWeek} />
        <StatCard icon={<Shield className="h-4 w-4" />} label="Flagged" value={stats.flagged} accent />
        <StatCard icon={<Search className="h-4 w-4" />} label="Avg Results" value={stats.avgResults} />
      </div>

      <p className="text-sm text-muted-foreground">{stats.uniqueIps} unique visitors have used AI Discover</p>

      <div className="flex gap-2">
        <Button variant={showFlagged ? "default" : "outline"} size="sm" onClick={() => setShowFlagged(!showFlagged)} className="gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          {showFlagged ? "Show All" : "Show Flagged Only"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-primary" onClick={() => toggleSort("created_at")}>
                  Time {sortBy === "created_at" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th className="px-4 py-3 font-medium">IP Hash</th>
                <th className="px-4 py-3 font-medium">Prompt</th>
                <th className="px-4 py-3 font-medium text-center cursor-pointer hover:text-primary" onClick={() => toggleSort("result_count")}>
                  Results {sortBy === "result_count" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((req) => (
                <tr key={req.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{format(new Date(req.created_at), "MM/dd HH:mm")}</td>
                  <td className="px-4 py-3 font-mono text-xs">{req.ip_hash.slice(0, 8)}</td>
                  <td className="px-4 py-3 max-w-[300px] truncate">{req.prompt_text}</td>
                  <td className="px-4 py-3 text-center">{req.result_count}</td>
                  <td className="px-4 py-3 text-center">
                    {req.flagged ? (
                      <Badge variant="destructive" className="text-xs">{req.flag_reason || "flagged"}</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">OK</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No AI requests yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
