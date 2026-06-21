import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type Model = {
  id: string;
  name: string;
  brand_id: string;
  image_url: string | null;
  verified: boolean;
  pending_review: boolean;
  created_at: string;
  brands?: { name: string } | null;
};

type Group = {
  key: string;
  brandName: string;
  name: string;
  keeper: Model;
  dupes: Model[];
};

const norm = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "");

function pickKeeper(rows: Model[]): Model {
  // Prefer verified, then has image, then oldest
  return [...rows].sort((a, b) => {
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    const ai = a.image_url ? 1 : 0;
    const bi = b.image_url ? 1 : 0;
    if (ai !== bi) return bi - ai;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  })[0];
}

async function fetchAllModels(): Promise<Model[]> {
  const pageSize = 1000;
  const all: Model[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("models")
      .select("id,name,brand_id,image_url,verified,pending_review,created_at,brands(name)")
      .order("created_at")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as Model[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export function CatalogDedup() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);

  const scan = async () => {
    setBusy(true);
    try {
      toast.info("Scanning catalog...");
      const all = await fetchAllModels();
      const buckets = new Map<string, Model[]>();
      for (const m of all) {
        const k = `${m.brand_id}::${norm(m.name)}`;
        const arr = buckets.get(k) ?? [];
        arr.push(m);
        buckets.set(k, arr);
      }
      const groups: Group[] = [];
      for (const [k, rows] of buckets) {
        if (rows.length < 2) continue;
        const keeper = pickKeeper(rows);
        groups.push({
          key: k,
          brandName: keeper.brands?.name ?? "—",
          name: keeper.name,
          keeper,
          dupes: rows.filter((r) => r.id !== keeper.id),
        });
      }
      groups.sort((a, b) => b.dupes.length - a.dupes.length);
      setGroups(groups);
      setOpen(true);
      if (!groups.length) toast.success("No duplicates found");
      else toast.info(`Found ${groups.length} duplicate group(s)`);
    } catch (e: any) {
      toast.error(e.message ?? "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  const merge = async () => {
    if (!groups.length) return;
    if (!confirm(`Merge ${groups.length} groups? Reviews will be re-linked to the keeper and duplicates deleted.`)) return;
    setBusy(true);
    let merged = 0, errors = 0;
    try {
      for (const g of groups) {
        const dupeIds = g.dupes.map((d) => d.id);
        // Re-link reviews
        const { error: rErr } = await supabase
          .from("reviews")
          .update({ model_id: g.keeper.id })
          .in("model_id", dupeIds);
        if (rErr) { errors++; console.error("review relink", rErr); continue; }
        // If keeper missing image, take one from a dupe
        if (!g.keeper.image_url) {
          const donor = g.dupes.find((d) => d.image_url);
          if (donor) {
            await supabase.from("models").update({ image_url: donor.image_url }).eq("id", g.keeper.id);
          }
        }
        const { error: dErr } = await supabase.from("models").delete().in("id", dupeIds);
        if (dErr) { errors++; console.error("delete dupes", dErr); continue; }
        merged++;
      }
      qc.invalidateQueries({ queryKey: ["admin-models"] });
      toast.success(`Merged ${merged} group(s)${errors ? `, ${errors} error(s)` : ""}`);
      setOpen(false);
      setGroups([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" disabled={busy} onClick={scan} className="rounded-none gap-2">
        <Copy className="w-4 h-4" /> Find Duplicates
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Duplicate models ({groups.length})</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {groups.length === 0 ? (
              <p className="text-muted-foreground">No duplicates found.</p>
            ) : (
              <>
                <p className="text-muted-foreground">
                  Models matched by brand + normalized name. The keeper is chosen by: verified, then has image, then oldest. Reviews are re-linked to the keeper before duplicates are deleted.
                </p>
                <ul className="divide-y border">
                  {groups.slice(0, 200).map((g) => (
                    <li key={g.key} className="p-2">
                      <div className="font-medium">{g.brandName} — {g.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Keep: {g.keeper.id.slice(0, 8)}{g.keeper.verified ? " ✓" : ""}{g.keeper.image_url ? " 🖼" : ""} · Delete {g.dupes.length} dupe(s)
                      </div>
                    </li>
                  ))}
                </ul>
                {groups.length > 200 && (
                  <p className="text-xs text-muted-foreground">Showing first 200 of {groups.length}.</p>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy || !groups.length} onClick={merge} className="rounded-none">
              Merge & Delete Duplicates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
