import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { RefreshCw, Sparkles, Image as ImageIcon, ChevronRight, Link as LinkIcon } from "lucide-react";

export default function AdminCatalogHealth() {
  const [openJobId, setOpenJobId] = useState<string | null>(null);

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

  const { data: jobs, refetch: refetchJobs } = useQuery({
    queryKey: ["catalog-jobs"],
    queryFn: async () => {
      const { data } = await supabase.from("catalog_jobs").select("*").order("started_at", { ascending: false }).limit(20);
      return data ?? [];
    },
    refetchInterval: 3000,
  });

  const trigger = async (fn: string, label: string, body?: any) => {
    toast.info(`${label} started...`);
    const { data, error } = await supabase.functions.invoke(fn, { body: body ?? {} });
    if (error) { toast.error(error.message); return; }
    toast.success(`${label} complete`);
    refetch();
    refetchJobs();
    if (data?.jobId) setOpenJobId(data.jobId);
  };

  const enrichOneModel = async () => {
    const id = window.prompt("Model ID to enrich:");
    if (!id) return;
    await trigger("enrich-shoe-images", "Image enrichment", { modelId: id.trim() });
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
          <Button variant="outline" onClick={enrichOneModel} className="rounded-none gap-2"><ImageIcon className="w-4 h-4" /> Enrich one</Button>
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
          <p className="text-xs text-muted-foreground mt-1">Click a job to see step-by-step progress.</p>
        </div>
        <div className="divide-y divide-border">
          {jobs?.length === 0 && <p className="p-4 text-sm text-muted-foreground">No jobs yet.</p>}
          {jobs?.map((j: any) => (
            <button key={j.id} onClick={() => setOpenJobId(j.id)} className="w-full p-4 flex justify-between items-center gap-4 flex-wrap text-left hover:bg-muted/50 transition-colors">
              <div>
                <div className="font-medium">{j.job_name}</div>
                <p className="text-xs text-muted-foreground">{new Date(j.started_at).toLocaleString()}{j.notes ? ` — ${j.notes}` : ""}</p>
              </div>
              <div className="flex gap-2 items-center text-xs">
                <span>+{j.models_added}</span>
                <span>~{j.models_updated}</span>
                <Badge variant={j.status === "completed" ? "default" : j.status === "running" ? "secondary" : "destructive"} className="rounded-none">{j.status}</Badge>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      </Card>

      <JobDrawer jobId={openJobId} onClose={() => setOpenJobId(null)} />
    </div>
  );
}

function JobDrawer({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  const { data: job } = useQuery({
    queryKey: ["catalog-job", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const { data } = await supabase.from("catalog_jobs").select("*").eq("id", jobId).maybeSingle();
      return data;
    },
    enabled: !!jobId,
    refetchInterval: (q) => (q.state.data?.status === "running" ? 2000 : false),
  });

  const { data: events } = useQuery({
    queryKey: ["catalog-job-events", jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data } = await supabase.from("catalog_job_events").select("*").eq("job_id", jobId).order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!jobId,
    refetchInterval: (q) => {
      const last: any = (q.state.data as any[])?.slice(-1)[0];
      // keep polling for a bit even after the job ends in case events trail
      if (!last) return 2000;
      const age = Date.now() - new Date(last.created_at).getTime();
      return age < 15000 ? 2000 : false;
    },
  });

  // group by model
  const grouped: Record<string, any[]> = {};
  const order: string[] = [];
  for (const e of events ?? []) {
    const key = e.model_id ?? "__queue__";
    if (!grouped[key]) { grouped[key] = []; order.push(key); }
    grouped[key].push(e);
  }

  return (
    <Sheet open={!!jobId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display tracking-wider uppercase">
            {job?.job_name ?? "Job"} {job && <Badge variant="secondary" className="ml-2 rounded-none">{job.status}</Badge>}
          </SheetTitle>
          {job?.notes && <p className="text-xs text-muted-foreground">{job.notes}</p>}
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {(events?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Waiting for events…</p>}
          {order.map((key) => {
            const evs = grouped[key];
            const label = key === "__queue__" ? "Queue" : evs[0]?.model_name ?? key.slice(0, 8);
            const uploadEv = evs.find((e) => e.stage === "uploaded");
            const thumb = uploadEv?.data?.image_url;
            const modelId = key === "__queue__" ? null : key;
            return (
              <div key={key} className="border border-border">
                <div className="flex items-center gap-3 p-3 border-b border-border bg-muted/30">
                  {thumb && <img src={thumb} alt="" className="w-12 h-12 object-cover" />}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{label}</div>
                    {key !== "__queue__" && <div className="text-[10px] text-muted-foreground font-mono">{key}</div>}
                  </div>
                </div>
                {modelId && <ManualImagePaste modelId={modelId} />}
                <div className="divide-y divide-border">
                  {evs.map((e) => <EventRow key={e.id} ev={e} />)}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EventRow({ ev }: { ev: any }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const color =
    ev.status === "ok" ? "bg-green-500" :
    ev.status === "error" ? "bg-red-500" :
    ev.status === "warn" ? "bg-yellow-500" : "bg-muted-foreground";
  const d = ev.data ?? {};
  const verdict = d.verdict;
  const candidates: { image_url: string; page_url?: string }[] = Array.isArray(d.candidates)
    ? d.candidates.filter((c: any) => c?.image_url)
    : d.image_url ? [{ image_url: d.image_url, page_url: d.page_url }] : [];

  const pick = async (url: string, sourceUrl?: string) => {
    if (!ev.model_id) { toast.error("No model linked to this event"); return; }
    setSaving(url);
    const { error } = await supabase
      .from("models")
      .update({ image_url: url, image_source_url: sourceUrl ?? null, pending_review: false })
      .eq("id", ev.model_id);
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    setSavedUrl(url);
    toast.success("Image saved to model");
  };

  return (
    <div className="p-3 text-xs">
      <button onClick={() => ev.data && setOpen(!open)} className="w-full flex items-start gap-2 text-left">
        <span className={`mt-1 w-2 h-2 rounded-full ${color} shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between gap-2">
            <span className="font-medium uppercase tracking-wider">{ev.stage}</span>
            <span className="text-muted-foreground">{new Date(ev.created_at).toLocaleTimeString()}</span>
          </div>
          {ev.message && <div className="text-muted-foreground mt-0.5 break-words">{ev.message}</div>}
          {verdict && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              detected: <span className="font-mono">{verdict.detected_brand ?? "?"} / {verdict.detected_model ?? "?"}</span>
              {" — "}
              brand:{String(verdict.brand_match)} · model:{String(verdict.model_match)} · side:{String(verdict.side_view)}
            </div>
          )}
        </div>
      </button>
      {candidates.length > 0 && (
        <div className="mt-2 ml-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {candidates.slice(0, 12).map((c, i) => {
            const isSaved = savedUrl === c.image_url;
            return (
              <div key={i} className={`border ${isSaved ? "border-green-500" : "border-border"} p-1 flex flex-col gap-1`}>
                <a href={c.page_url ?? c.image_url} target="_blank" rel="noreferrer">
                  <img src={c.image_url} alt="" className="w-full h-24 object-contain bg-white" />
                </a>
                <Button
                  size="sm"
                  variant={isSaved ? "default" : "outline"}
                  disabled={saving === c.image_url || !ev.model_id}
                  onClick={(e) => { e.stopPropagation(); pick(c.image_url, c.page_url); }}
                  className="rounded-none h-7 text-[10px]"
                >
                  {isSaved ? "✓ Saved" : saving === c.image_url ? "Saving…" : "Use this"}
                </Button>
                {c.page_url && (
                  <a href={c.page_url} target="_blank" rel="noreferrer" className="text-[9px] underline truncate text-muted-foreground">
                    {new URL(c.page_url).hostname}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
      {open && ev.data && (
        <pre className="mt-2 ml-4 p-2 bg-muted overflow-x-auto text-[10px] whitespace-pre-wrap break-all">{JSON.stringify(ev.data, null, 2)}</pre>
      )}
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
