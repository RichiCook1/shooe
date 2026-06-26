import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

type Props = {
  brand: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditBrandDialog({ brand, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({});
  const [researching, setResearching] = useState(false);

  useEffect(() => {
    if (brand) {
      setForm({
        name: brand.name ?? "",
        country: brand.country ?? "",
        website: brand.website ?? "",
        notes: brand.notes ?? "",
      });
    }
  }, [brand]);

  const save = useMutation({
    mutationFn: async () => {
      if (!brand) return;
      if (!form.name.trim()) throw new Error("Name required");
      const { error } = await supabase.from("brands").update({
        name: form.name.trim(),
        country: form.country?.trim() || null,
        website: form.website?.trim() || null,
        notes: form.notes?.trim() || null,
      }).eq("id", brand.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      qc.invalidateQueries({ queryKey: ["admin-all-brands"] });
      toast.success("Brand updated");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const research = async () => {
    if (!brand) return;
    setResearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("research-brand", { body: { brand_id: brand.id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setForm((f: any) => ({ ...f, notes: data.notes ?? "" }));
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      toast.success("Brand facts updated");
    } catch (e: any) {
      toast.error(e.message ?? "Research failed");
    } finally {
      setResearching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Brand</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input className="rounded-none" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Country</Label>
            <Input className="rounded-none" value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <div>
            <Label>Website</Label>
            <Input className="rounded-none" value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Brand facts (used by Shoe Sherpa)</Label>
              <Button type="button" variant="outline" size="sm" className="rounded-none" onClick={research} disabled={researching}>
                {researching ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                Auto-research
              </Button>
            </div>
            <Textarea
              className="rounded-none min-h-[200px] font-mono text-xs"
              placeholder="e.g. - HQ: France&#10;- Width options: standard, wide&#10;- Known for: max-cushion road shoes"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">Verified facts the Sherpa can quote (width options, fit, tech, etc.). Click Auto-research to populate via Perplexity.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-none" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="rounded-none" disabled={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
