import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminModeration() {
  const qc = useQueryClient();

  const { data: reviews } = useQuery({
    queryKey: ["admin-mod-reviews"],
    queryFn: async () => (await supabase.from("reviews").select("id, content, created_at, user_id, model_id, rating").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  const { data: comments } = useQuery({
    queryKey: ["admin-mod-comments"],
    queryFn: async () => (await supabase.from("comments").select("id, content, created_at, user_id, review_id").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  const delReview = useMutation({
    mutationFn: async (id: string) => { await supabase.from("reviews").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-mod-reviews"] }); toast.success("Review deleted"); },
  });

  const delComment = useMutation({
    mutationFn: async (id: string) => { await supabase.from("comments").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-mod-comments"] }); toast.success("Comment deleted"); },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display tracking-wider uppercase">Moderation</h1>
      <Tabs defaultValue="reviews">
        <TabsList className="rounded-none">
          <TabsTrigger value="reviews" className="rounded-none">Reviews</TabsTrigger>
          <TabsTrigger value="comments" className="rounded-none">Comments</TabsTrigger>
        </TabsList>
        <TabsContent value="reviews" className="space-y-2">
          {reviews?.map((r: any) => (
            <Card key={r.id} className="p-3 rounded-none border-border flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()} · ★ {r.rating ?? "—"}</p>
                <p className="text-sm mt-1 line-clamp-3">{r.content || <em className="text-muted-foreground">(no content)</em>}</p>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm("Delete review?")) delReview.mutate(r.id); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="comments" className="space-y-2">
          {comments?.map((c: any) => (
            <Card key={c.id} className="p-3 rounded-none border-border flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
                <p className="text-sm mt-1 line-clamp-3">{c.content}</p>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm("Delete comment?")) delComment.mutate(c.id); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
