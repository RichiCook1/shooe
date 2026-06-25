import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  brand: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditBrandDialog({ brand, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (brand) {
      setForm({
        name: brand.name ?? "",
        country: brand.country ?? "",
        website: brand.website ?? "",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none">
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
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-none" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="rounded-none" disabled={save.isPending} onClick={() => save.mutate()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
