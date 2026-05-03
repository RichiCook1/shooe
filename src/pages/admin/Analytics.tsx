import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

export default function AdminAnalytics() {
  const { data: tagFreq } = useQuery({
    queryKey: ["analytics-tags"],
    queryFn: async () => {
      const { data: rt } = await supabase.from("review_tags").select("tag_id");
      const counts: Record<string, number> = {};
      (rt ?? []).forEach((r: any) => { counts[r.tag_id] = (counts[r.tag_id] || 0) + 1; });
      const ids = Object.keys(counts);
      if (!ids.length) return [];
      const { data: tags } = await supabase.from("tags").select("id, label").in("id", ids);
      return (tags ?? []).map((t: any) => ({ name: t.label, count: counts[t.id] || 0 })).sort((a, b) => b.count - a.count).slice(0, 15);
    },
  });

  const { data: brandPerf } = useQuery({
    queryKey: ["analytics-brands"],
    queryFn: async () => {
      const { data: models } = await supabase.from("models").select("id, brand_id, brands(name)");
      const { data: reviews } = await supabase.from("reviews").select("model_id");
      const modelToBrand: Record<string, string> = {};
      (models ?? []).forEach((m: any) => { modelToBrand[m.id] = m.brands?.name || "Unknown"; });
      const counts: Record<string, number> = {};
      (reviews ?? []).forEach((r: any) => {
        const b = modelToBrand[r.model_id] || "Unknown";
        counts[b] = (counts[b] || 0) + 1;
      });
      return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    },
  });

  const { data: timeline } = useQuery({
    queryKey: ["analytics-timeline"],
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("created_at").order("created_at", { ascending: true });
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        const d = new Date(r.created_at).toISOString().slice(0, 10);
        counts[d] = (counts[d] || 0) + 1;
      });
      return Object.entries(counts).map(([date, count]) => ({ date, count }));
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display tracking-wider uppercase">Analytics</h1>

      <Card className="p-4 rounded-none border-border">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Top Tags</h2>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={tagFreq ?? []}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--foreground))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4 rounded-none border-border">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Reviews per Brand</h2>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={brandPerf ?? []}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--foreground))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4 rounded-none border-border">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Reviews Over Time</h2>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={timeline ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
