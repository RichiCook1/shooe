import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Props = {
  model: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const CATEGORIES = ["road", "trail", "racing", "training", "hiking", "lifestyle"];

export function EditModelDialog({ model, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({});

  const { data: allBrands } = useQuery({
    queryKey: ["admin-all-brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name").order("name").limit(1000);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (model) {
      setForm({
        name: model.name ?? "",
        brand_id: model.brand_id ?? "",
        category: model.category ?? "road",
        release_year: model.release_year ?? "",
        stack_height_mm: model.stack_height_mm ?? "",
        drop_mm: model.drop_mm ?? "",
        weight_g: model.weight_g ?? "",
        msrp: model.msrp ?? "",
        image_url: model.image_url ?? "",
        image_source_url: model.image_source_url ?? "",
        verified: !!model.verified,
        pending_review: !!model.pending_review,
      });
    }
  }, [model]);

  const save = useMutation({
    mutationFn: async () => {
      if (!model) return;
      if (!form.name.trim()) throw new Error("Name required");
      if (!form.brand_id) throw new Error("Brand required");
      const num = (v: any) => (v === "" || v === null ? null : Number(v));
      const { error } = await supabase.from("models").update({
        name: form.name.trim(),
        brand_id: form.brand_id,
        category: form.category,
        release_year: num(form.release_year),
        stack_height_mm: num(form.stack_height_mm),
        drop_mm: num(form.drop_mm),
        weight_g: num(form.weight_g),
        msrp: num(form.msrp),
        image_url: form.image_url?.trim() || null,
        image_source_url: form.image_source_url?.trim() || null,
        verified: form.verified,
        pending_review: form.pending_review,
      }).eq("id", model.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-models"] });
      toast.success("Model updated");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Model</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Name</Label>
            <Input className="rounded-none" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <Label>Brand</Label>
            <Select value={form.brand_id ?? ""} onValueChange={(v) => set("brand_id", v)}>
              <SelectTrigger className="rounded-none"><SelectValue placeholder="Brand" /></SelectTrigger>
              <SelectContent>
                {allBrands?.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={form.category ?? "road"} onValueChange={(v) => set("category", v)}>
              <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Release year</Label>
            <Input type="number" className="rounded-none" value={form.release_year ?? ""} onChange={(e) => set("release_year", e.target.value)} />
          </div>
          <div>
            <Label>MSRP</Label>
            <Input type="number" step="0.01" className="rounded-none" value={form.msrp ?? ""} onChange={(e) => set("msrp", e.target.value)} />
          </div>
          <div>
            <Label>Weight (g)</Label>
            <Input type="number" step="0.1" className="rounded-none" value={form.weight_g ?? ""} onChange={(e) => set("weight_g", e.target.value)} />
          </div>
          <div>
            <Label>Stack height (mm)</Label>
            <Input type="number" step="0.1" className="rounded-none" value={form.stack_height_mm ?? ""} onChange={(e) => set("stack_height_mm", e.target.value)} />
          </div>
          <div>
            <Label>Drop (mm)</Label>
            <Input type="number" step="0.1" className="rounded-none" value={form.drop_mm ?? ""} onChange={(e) => set("drop_mm", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Image URL</Label>
            <Input className="rounded-none" value={form.image_url ?? ""} onChange={(e) => set("image_url", e.target.value)} />
            {form.image_url && <img src={form.image_url} alt="" className="mt-2 h-24 object-contain bg-muted" />}
          </div>
          <div className="col-span-2">
            <Label>Image source URL</Label>
            <Input className="rounded-none" value={form.image_source_url ?? ""} onChange={(e) => set("image_source_url", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.verified} onChange={(e) => set("verified", e.target.checked)} /> Verified
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.pending_review} onChange={(e) => set("pending_review", e.target.checked)} /> Pending review
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-none" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="rounded-none" disabled={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
