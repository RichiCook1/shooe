import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Sparkles, Image as ImageIcon } from "lucide-react";

export default function AdminCatalogHealth() {
  const { data: stats, refetch } = useQuery({
    queryKey: ["catalog-health"],
    queryFn: async () => {
      const [{ count: brandCount }, { count: modelCount }, { count: verifiedCount }, { count: withImageCount }, { count: pendingCount }, { count: recent7 }] = await Promise.all([
        supabase.from("brands").select("*", { count: "exact", head: true }),
        supabase.from("models").select("*", { count: "exact", head: true }),
        supabase.from("models").select("*", { count: "exact", head: true }).eq("verified", true),
        supabase.from("models").select("*", { count: "exact", head: true }).not("image_url", "is", null),
        supabase.from("models").select("*", { count: "exact", head: true }).eq("pending_review", true),
        supabase.from("models").select("*", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString()),
      ]);
      return { brandCount, modelCount, verifiedCount, withImageCount, pendingCount, recent7 };
    },
  });

  const { data: jobs } = useQuery({
    queryKey: ["catalog-jobs"],
    queryFn: async () => {
      const { data } = await supabase.from("catalog_jobs").select("*").order("started_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const trigger = async (fn: string, label: string, body?: any) => {
    toast.info(`${label} started...`);
    const { error } = await supabase.functions.invoke(fn, { body: body ?? {} });
    if (error) toast.error(error.message); else toast.success(`${label} complete`);
    refetch();
  };

  const pct = (n?: number | null, d?: number | null) =>
    !d ? "0%" : `${Math.round((100 * (n ?? 0)) / d)}%`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-display tracking-wider uppercase">Catalog Health</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => trigger("discover-new-shoes", "Discover", { limit: 100 })} className="rounded-none gap-2"><RefreshCw className="w-4 h-4" /> Discover new</Button>
          <Button variant="outline" onClick={() => trigger("seed-brand-catalog", "Seed", {})} className="rounded-none gap-2"><Sparkles className="w-4 h-4" /> Seed brand</Button>
          <Button variant="outline" onClick={() => trigger("enrich-shoe-images", "Image enrichment", { limit: 25 })} className="rounded-none gap-2"><ImageIcon className="w-4 h-4" /> Enrich images</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Brands" value={stats?.brandCount ?? 0} />
        <Stat label="Models" value={stats?.modelCount ?? 0} />
        <Stat label="Verified" value={pct(stats?.verifiedCount, stats?.modelCount)} />
        <Stat label="With image" value={pct(stats?.withImageCount, stats?.modelCount)} />
        <Stat label="Pending" value={stats?.pendingCount ?? 0} />
        <Stat label="Added 7d" value={stats?.recent7 ?? 0} />
      </div>

      <Card className="rounded-none border-border">
        <div className="p-4 border-b border-border">
          <h2 className="font-display tracking-wider uppercase">Recent Jobs</h2>
        </div>
        <div className="divide-y divide-border">
          {jobs?.length === 0 && <p className="p-4 text-sm text-muted-foreground">No jobs yet.</p>}
          {jobs?.map((j: any) => (
            <div key={j.id} className="p-4 flex justify-between items-center gap-4 flex-wrap">
              <div>
                <div className="font-medium">{j.job_name}</div>
                <p className="text-xs text-muted-foreground">{new Date(j.started_at).toLocaleString()}{j.notes ? ` — ${j.notes}` : ""}</p>
              </div>
              <div className="flex gap-2 items-center text-xs">
                <span>+{j.models_added}</span>
                <span>~{j.models_updated}</span>
                <Badge variant={j.status === "completed" ? "default" : j.status === "running" ? "secondary" : "destructive"} className="rounded-none">{j.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="rounded-none border-border p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-display mt-1">{value}</div>
    </Card>
  );
}
