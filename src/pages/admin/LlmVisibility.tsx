import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, ExternalLink, Trash2, Play, Sparkles, Radio } from "lucide-react";

const BOT_NAMES = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "PerplexityBot", "Perplexity-User",
  "ClaudeBot", "Claude-Web", "Anthropic-AI",
  "Google-Extended", "Googlebot",
  "Bingbot", "CCBot", "Applebot-Extended",
];

function encQ(q: string) { return encodeURIComponent(q); }

const MANUAL_LINKS = (q: string) => [
  { label: "Perplexity", url: `https://www.perplexity.ai/search?q=${encQ(q)}` },
  { label: "ChatGPT", url: `https://chatgpt.com/?q=${encQ(q)}` },
  { label: "Google AI Mode", url: `https://www.google.com/search?udm=50&q=${encQ(q)}` },
  { label: "Claude", url: `https://claude.ai/new?q=${encQ(q)}` },
];

export default function LlmVisibility() {
  const qc = useQueryClient();

  // ---- Crawler hits ----
  const { data: hits } = useQuery({
    queryKey: ["llm-crawler-hits"],
    queryFn: async () => {
      const { data } = await supabase
        .from("llm_crawler_hits")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const botStats = useMemo(() => {
    const map = new Map<string, { count: number; last: string }>();
    (hits ?? []).forEach((h: any) => {
      const cur = map.get(h.bot_name) || { count: 0, last: h.created_at };
      cur.count++;
      if (h.created_at > cur.last) cur.last = h.created_at;
      map.set(h.bot_name, cur);
    });
    return BOT_NAMES.map((name) => ({
      name,
      count: map.get(name)?.count ?? 0,
      last: map.get(name)?.last ?? null,
    })).sort((a, b) => b.count - a.count);
  }, [hits]);

  const topPaths = useMemo(() => {
    const map = new Map<string, number>();
    (hits ?? []).forEach((h: any) => map.set(h.path || "/", (map.get(h.path || "/") ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  }, [hits]);

  // ---- Probes ----
  const { data: probes } = useQuery({
    queryKey: ["citation-probes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("citation_probes")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: runs } = useQuery({
    queryKey: ["citation-probe-runs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("citation_probe_runs")
        .select("*")
        .order("run_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const runsByProbe = useMemo(() => {
    const map = new Map<string, any[]>();
    (runs ?? []).forEach((r: any) => {
      const arr = map.get(r.probe_id) || [];
      arr.push(r);
      map.set(r.probe_id, arr);
    });
    return map;
  }, [runs]);

  const overallStats = useMemo(() => {
    const total = runs?.length ?? 0;
    const cited = (runs ?? []).filter((r: any) => r.was_cited).length;
    return { total, cited, rate: total ? Math.round((cited / total) * 100) : 0 };
  }, [runs]);

  const [newQ, setNewQ] = useState("");
  const [runningId, setRunningId] = useState<string | null>(null);

  const addProbe = useMutation({
    mutationFn: async (question: string) => {
      const { error } = await supabase.from("citation_probes").insert({ question });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewQ("");
      qc.invalidateQueries({ queryKey: ["citation-probes"] });
      toast.success("Probe added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("citation_probes").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["citation-probes"] }),
  });

  const deleteProbe = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("citation_probes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["citation-probes"] }),
  });

  const runOne = async (probeId: string) => {
    setRunningId(probeId);
    try {
      const { data, error } = await supabase.functions.invoke("probe-llm-citations", {
        body: { probe_id: probeId },
      });
      if (error) throw error;
      toast.success(`Ran probe. Cited: ${data?.cited ?? 0}/${data?.total ?? 0}`);
      qc.invalidateQueries({ queryKey: ["citation-probe-runs"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunningId(null);
    }
  };

  const runAll = async () => {
    setRunningId("__all__");
    try {
      const { data, error } = await supabase.functions.invoke("probe-llm-citations", { body: {} });
      if (error) throw error;
      toast.success(`Ran ${data?.total ?? 0} probes. Cited: ${data?.cited ?? 0}`);
      qc.invalidateQueries({ queryKey: ["citation-probe-runs"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <Helmet><title>LLM Visibility · Admin</title></Helmet>

      <div>
        <h1 className="text-2xl md:text-3xl font-display uppercase tracking-wider">LLM Visibility</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Are AI crawlers fetching us, and are LLMs citing us?
        </p>
      </div>

      <Tabs defaultValue="crawlers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="crawlers">Crawler Hits</TabsTrigger>
          <TabsTrigger value="citations">Citation Probes</TabsTrigger>
          <TabsTrigger value="manual">Manual Checks</TabsTrigger>
        </TabsList>

        {/* CRAWLERS */}
        <TabsContent value="crawlers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bots seen (last 500 hits)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {botStats.map((b) => (
                  <div key={b.name} className="border border-border rounded p-3">
                    <p className="text-xs text-muted-foreground">{b.name}</p>
                    <p className="text-2xl font-display">{b.count}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {b.last ? `Last: ${new Date(b.last).toLocaleString()}` : "Never seen"}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Top pages crawled</CardTitle></CardHeader>
              <CardContent>
                {topPaths.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hits yet.</p>
                ) : (
                  <div className="space-y-1">
                    {topPaths.map(([path, count]) => (
                      <div key={path} className="flex justify-between text-sm border-b border-border py-1">
                        <span className="truncate mr-2 font-mono text-xs">{path}</span>
                        <span className="text-muted-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Recent hits</CardTitle></CardHeader>
              <CardContent className="max-h-96 overflow-y-auto">
                {(hits ?? []).slice(0, 50).map((h: any) => (
                  <div key={h.id} className="text-xs border-b border-border py-1.5">
                    <div className="flex justify-between">
                      <Badge variant="outline" className="text-[10px]">{h.bot_name}</Badge>
                      <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                    </div>
                    <p className="font-mono truncate mt-0.5">{h.path}</p>
                  </div>
                ))}
                {(!hits || hits.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    No AI crawler hits recorded yet. Beacon will log any visitor whose User-Agent matches a known AI bot.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CITATIONS */}
        <TabsContent value="citations" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Overall citation rate</CardTitle>
              <Button size="sm" onClick={runAll} disabled={runningId !== null}>
                {runningId === "__all__" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
                Run all now
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6">
                <div><p className="text-xs text-muted-foreground">Total runs</p><p className="text-2xl font-display">{overallStats.total}</p></div>
                <div><p className="text-xs text-muted-foreground">Cited us</p><p className="text-2xl font-display">{overallStats.cited}</p></div>
                <div><p className="text-xs text-muted-foreground">Rate</p><p className="text-2xl font-display">{overallStats.rate}%</p></div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Probes run via Perplexity Sonar. Cron runs weekly; use "Run all now" for on-demand.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Add probe</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <form
                onSubmit={(e) => { e.preventDefault(); if (newQ.trim()) addProbe.mutate(newQ.trim()); }}
                className="flex gap-2"
              >
                <Input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="e.g. Best carbon race shoes 2026" />
                <Button type="submit" disabled={!newQ.trim() || addProbe.isPending}>Add</Button>
              </form>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const t = toast.loading("Seeding long-tail probes…");
                    const { data, error } = await supabase.functions.invoke("seed-longtail-probes", { body: { top_n: 40 } });
                    toast.dismiss(t);
                    if (error) return toast.error(error.message);
                    toast.success(`Seeded ${data?.inserted ?? 0} new probes (skipped ${data?.skipped_duplicates ?? 0} dupes)`);
                    qc.invalidateQueries({ queryKey: ["citation-probes"] });
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" /> Seed long-tail probes (top 40 models × 6 queries)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const t = toast.loading("Pinging IndexNow…");
                    const { data, error } = await supabase.functions.invoke("ping-indexnow", {
                      body: { urls: ["https://shoe-sherpa.com/", "https://shoe-sherpa.com/sitemap.xml"] },
                    });
                    toast.dismiss(t);
                    if (error) return toast.error(error.message);
                    toast.success(`IndexNow → status ${data?.status}`);
                  }}
                >
                  <Radio className="w-3.5 h-3.5 mr-1" /> Ping IndexNow (Bing/Copilot)
                </Button>
              </div>
            </CardContent>
          </Card>

              >
                <Input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="e.g. Best carbon race shoes 2026" />
                <Button type="submit" disabled={!newQ.trim() || addProbe.isPending}>Add</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Probes</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead>Last</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(probes ?? []).map((p: any) => {
                    const pRuns = runsByProbe.get(p.id) ?? [];
                    const last = pRuns[0];
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium max-w-sm">
                          <p className="truncate">{p.question}</p>
                          {last?.answer_text && (
                            <details className="mt-1">
                              <summary className="text-xs text-muted-foreground cursor-pointer">Last answer</summary>
                              <p className="text-xs mt-1 whitespace-pre-wrap max-h-40 overflow-y-auto bg-muted p-2 rounded">
                                {last.answer_text}
                              </p>
                              {last.cited_urls?.length > 0 && (
                                <div className="text-[10px] mt-1 space-y-0.5">
                                  {last.cited_urls.slice(0, 8).map((u: string, i: number) => (
                                    <a key={i} href={u} target="_blank" rel="noreferrer"
                                       className={`block truncate ${/shoe-sherpa\.com/i.test(u) ? "text-green-600 font-semibold" : "text-muted-foreground"}`}>
                                      {i + 1}. {u}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </details>
                          )}
                        </TableCell>
                        <TableCell><Badge variant="outline">{p.category ?? "—"}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs">
                            {pRuns.slice(0, 8).reverse().map((r: any) => (
                              r.was_cited
                                ? <CheckCircle2 key={r.id} className="w-3.5 h-3.5 text-green-600" />
                                : <XCircle key={r.id} className="w-3.5 h-3.5 text-muted-foreground" />
                            ))}
                            {pRuns.length === 0 && <span className="text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {last ? new Date(last.run_at).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell>
                          <Switch checked={p.active} onCheckedChange={(v) => toggleActive.mutate({ id: p.id, active: v })} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => runOne(p.id)} disabled={runningId !== null}>
                              {runningId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteProbe.mutate(p.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MANUAL */}
        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Quick-check any question</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Type a running-shoe question and open it in each LLM to see if Shoe Sherpa appears in the citations.
              </p>
              <QuickChecker />
              <div className="border-t border-border pt-3 text-xs text-muted-foreground space-y-1">
                <p><strong>Google Search Console:</strong> filter by <em>Search appearance = AI Overviews</em> to see AI-Overview impressions.</p>
                <p><strong>Bing Webmaster Tools:</strong> check the "Search performance" report — Copilot cites Bing results.</p>
                <p><strong>ChatGPT / Claude:</strong> no public citation API — the probe tab is the closest proxy (Perplexity mirrors most of what generative engines cite).</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuickChecker() {
  const [q, setQ] = useState("best marathon shoes for wide feet");
  const links = MANUAL_LINKS(q);
  return (
    <div className="space-y-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a key={l.label} href={l.url} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              {l.label} <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </a>
        ))}
      </div>
    </div>
  );
}
