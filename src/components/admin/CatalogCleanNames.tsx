import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Scissors } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type Row = {
  id: string;
  name: string;
  brand_id: string;
  brands?: { name: string } | null;
};

type Fix = { id: string; brand: string; before: string; after: string };

async function fetchAll(): Promise<Row[]> {
  const pageSize = 1000;
  const all: Row[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("models")
      .select("id,name,brand_id,brands(name)")
      .order("created_at")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as Row[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function stripBrand(name: string, brand: string): string | null {
  if (!brand) return null;
  const n = name.trim();
  const b = brand.trim();
  // case-insensitive prefix match, also tolerate punctuation between
  const re = new RegExp(`^${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s:\\-–_]+`, "i");
  const cleaned = n.replace(re, "").trim();
  if (cleaned && cleaned.toLowerCase() !== n.toLowerCase()) return cleaned;
  return null;
}

export function CatalogCleanNames() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fixes, setFixes] = useState<Fix[]>([]);

  const scan = async () => {
    setBusy(true);
    try {
      toast.info("Scanning model names...");
      const rows = await fetchAll();
      const out: Fix[] = [];
      for (const r of rows) {
        const brand = r.brands?.name ?? "";
        const cleaned = stripBrand(r.name, brand);
        if (cleaned) out.push({ id: r.id, brand, before: r.name, after: cleaned });
      }
      setFixes(out);
      setOpen(true);
      if (!out.length) toast.success("No names need cleaning");
      else toast.info(`Found ${out.length} name(s) to clean`);
    } catch (e: any) {
      toast.error(e.message ?? "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!fixes.length) return;
    if (!confirm(`Update ${fixes.length} model name(s)?`)) return;
    setBusy(true);
    let ok = 0, err = 0;
    try {
      for (const f of fixes) {
        const { error } = await supabase.from("models").update({ name: f.after }).eq("id", f.id);
        if (error) { err++; console.error(error); } else ok++;
      }
      qc.invalidateQueries({ queryKey: ["admin-models"] });
      toast.success(`Updated ${ok}${err ? `, ${err} error(s)` : ""}`);
      setOpen(false);
      setFixes([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" disabled={busy} onClick={scan} className="rounded-none gap-2">
        <Scissors className="w-4 h-4" /> Clean Names
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Strip duplicated brand from model names ({fixes.length})</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {fixes.length === 0 ? (
              <p className="text-muted-foreground">Nothing to clean.</p>
            ) : (
              <ul className="divide-y border">
                {fixes.slice(0, 300).map((f) => (
                  <li key={f.id} className="p-2">
                    <div className="text-xs text-muted-foreground">{f.brand}</div>
                    <div><span className="line-through text-muted-foreground">{f.before}</span> → <span className="font-medium">{f.after}</span></div>
                  </li>
                ))}
                {fixes.length > 300 && (
                  <li className="p-2 text-xs text-muted-foreground">Showing first 300 of {fixes.length}.</li>
                )}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy || !fixes.length} onClick={apply} className="rounded-none">Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
