import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Check, X, RefreshCw } from "lucide-react";

export default function AdminQueue() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: items } = useQuery({
    queryKey: ["admin-queue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("model_review_queue")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const approve = useMutation({
    mutationFn: async (item: any) => {
      if (item.model_id) {
        await supabase.from("models").update({ verified: true, pending_review: false }).eq("id", item.model_id);
      }
      await supabase.from("model_review_queue").update({
        status: "approved", resolved_at: new Date().toISOString(), resolved_by: user?.id,
      }).eq("id", item.id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-queue"] }); toast.success("Approved"); },
  });

  const reject = useMutation({
    mutationFn: async (item: any) => {
      if (item.model_id) await supabase.from("models").delete().eq("id", item.model_id);
      await supabase.from("model_review_queue").update({
        status: "rejected", resolved_at: new Date().toISOString(), resolved_by: user?.id,
      }).eq("id", item.id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-queue"] }); toast.success("Rejected"); },
  });

  const recheck = async (item: any) => {
    toast.info("Re-validating...");
    const { error } = await supabase.functions.invoke("validate-shoe-name", {
      body: { brand: item.submitted_brand, model: item.submitted_model, queueId: item.id },
    });
    if (error) toast.error(error.message); else toast.success("Re-checked");
    qc.invalidateQueries({ queryKey: ["admin-queue"] });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display tracking-wider uppercase">Pending Queue</h1>
      <div className="space-y-3">
        {items?.length === 0 && <p className="text-sm text-muted-foreground">Nothing pending. </p>}
        {items?.map((item: any) => {
          const wc = item.web_check_result || {};
          return (
            <Card key={item.id} className="p-4 rounded-none border-border">
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium">{item.submitted_brand} — {item.submitted_model}</h3>
                    {wc.exists === true && <Badge className="rounded-none">Verified online</Badge>}
                    {wc.exists === false && <Badge variant="destructive" className="rounded-none">Not found online</Badge>}
                    {wc.suggested && wc.suggested !== item.submitted_model && (
                      <Badge variant="secondary" className="rounded-none">Suggested: {wc.suggested}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Submitted {new Date(item.created_at).toLocaleString()}
                  </p>
                  {wc.notes && <p className="text-sm mt-2 text-muted-foreground">{wc.notes}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => recheck(item)} className="rounded-none gap-1"><RefreshCw className="w-3 h-3" /> Recheck</Button>
                  <Button size="sm" variant="outline" onClick={() => reject.mutate(item)} className="rounded-none gap-1"><X className="w-3 h-3" /> Reject</Button>
                  <Button size="sm" onClick={() => approve.mutate(item)} className="rounded-none gap-1"><Check className="w-3 h-3" /> Approve</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
