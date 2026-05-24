import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trophy, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type Range = "all" | "7d" | "30d" | "today";

interface Row {
  userId: string;
  total: number;
  needsId: number;
  name: string;
  username: string | null;
  avatar: string | null;
}

const sinceFor = (r: Range): string | null => {
  const now = new Date();
  if (r === "all") return null;
  if (r === "today") {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d.toISOString();
  }
  const days = r === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 86400000).toISOString();
};

export default function AdminLeaderboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("all");

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("reviews")
      .select("guest_session_id, content, created_at")
      .like("guest_session_id", "interview:%")
      .limit(5000);
    const since = sinceFor(range);
    if (since) q = q.gte("created_at", since);

    const { data, error } = await q;
    if (error) { toast.error(error.message); setLoading(false); return; }

    const agg = new Map<string, { total: number; needsId: number }>();
    for (const r of data || []) {
      const parts = (r.guest_session_id || "").split(":");
      // formats: "interview:<uuid>" (legacy) or "interview:<adminId>:<uuid>"
      const adminId = parts.length >= 3 ? parts[1] : "legacy";
      if (!adminId) continue;
      const cur = agg.get(adminId) || { total: 0, needsId: 0 };
      cur.total += 1;
      if ((r.content || "").includes("[NEEDS SHOE IDENTIFICATION]")) cur.needsId += 1;
      agg.set(adminId, cur);
    }

    const ids = Array.from(agg.keys()).filter((id) => id && id !== "legacy" && id !== "anon");
    const profMap = new Map<string, { display_name: string | null; username: string | null; avatar_url: string | null }>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", ids);
      (profs || []).forEach((p) =>
        profMap.set(p.user_id, { display_name: p.display_name, username: p.username, avatar_url: p.avatar_url })
      );
    }

    const out: Row[] = Array.from(agg.entries()).map(([userId, v]) => {
      const p = profMap.get(userId);
      const labelLegacy = userId === "legacy" ? "Legacy (untagged)" : userId === "anon" ? "Anonymous" : null;
      return {
        userId,
        total: v.total,
        needsId: v.needsId,
        name: labelLegacy || p?.display_name || p?.username || `User ${userId.slice(0, 8)}`,
        username: p?.username || null,
        avatar: p?.avatar_url || null,
      };
    }).sort((a, b) => b.total - a.total);

    setRows(out);
    setLoading(false);
  };

  useEffect(() => { load(); }, [range]);

  const total = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display tracking-wider uppercase">Leaderboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} interview reviews · {rows.length} contributors
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-[140px] rounded-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <Card className="p-8 rounded-none border-border text-center text-sm text-muted-foreground">
          No interview reviews yet.
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <Card key={r.userId} className="p-4 rounded-none border-border flex items-center gap-4">
              <div className="w-10 text-center">
                {i === 0 ? (
                  <Trophy className="h-6 w-6 mx-auto" />
                ) : (
                  <span className="font-display text-2xl tracking-wider">{i + 1}</span>
                )}
              </div>
              {r.avatar ? (
                <img src={r.avatar} alt={r.name} className="w-10 h-10 object-cover bg-muted flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 bg-muted flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-display uppercase tracking-wide text-sm truncate">{r.name}</div>
                {r.username && (
                  <div className="text-xs text-muted-foreground truncate">@{r.username}</div>
                )}
              </div>
              <div className="text-right">
                <div className="font-display text-3xl tracking-wider tabular-nums">{r.total}</div>
                {r.needsId > 0 && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                    <AlertCircle className="h-3 w-3" />
                    {r.needsId} need ID
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
