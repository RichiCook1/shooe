import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

const Stat = ({ label, value }: { label: string; value: number | string }) => (
  <Card className="p-5 rounded-none border-border">
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="text-3xl font-display mt-2">{value}</div>
  </Card>
);

export default function AdminOverview() {
  const { data } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [users, reviews, brands, models, queue, recentReviews] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("reviews").select("id", { count: "exact", head: true }),
        supabase.from("brands").select("id", { count: "exact", head: true }),
        supabase.from("models").select("id", { count: "exact", head: true }),
        supabase.from("model_review_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("reviews").select("id, content, created_at, model_id").order("created_at", { ascending: false }).limit(5),
      ]);
      return {
        users: users.count ?? 0,
        reviews: reviews.count ?? 0,
        brands: brands.count ?? 0,
        models: models.count ?? 0,
        pending: queue.count ?? 0,
        recent: recentReviews.data ?? [],
      };
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display tracking-wider uppercase">Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Stat label="Users" value={data?.users ?? "—"} />
        <Stat label="Reviews" value={data?.reviews ?? "—"} />
        <Stat label="Brands" value={data?.brands ?? "—"} />
        <Stat label="Models" value={data?.models ?? "—"} />
        <Stat label="Pending Queue" value={data?.pending ?? "—"} />
      </div>

      <Card className="p-5 rounded-none border-border">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Recent Reviews</h2>
        <ul className="space-y-2">
          {data?.recent?.map((r: any) => (
            <li key={r.id} className="text-sm border-b border-border/50 pb-2 last:border-0">
              <span className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleString()}</span>
              <p className="line-clamp-2">{r.content || <em className="text-muted-foreground">(no content)</em>}</p>
            </li>
          ))}
          {!data?.recent?.length && <li className="text-sm text-muted-foreground">No reviews yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
