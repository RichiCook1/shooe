import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Star } from "lucide-react";

type Terrain = "road" | "trail" | "mixed" | "track";

export interface DraftReviewLite {
  id: string;
  content: string | null;
  model_id: string;
  rating: number | null;
  terrain: Terrain | null;
  distance_km: number | null;
  location: string | null;
  models: { id: string; name: string; brands: { id: string; name: string } | null } | null;
}

interface Props {
  draft: DraftReviewLite | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

export function EditDraftDialog({ draft, open, onOpenChange, onSaved }: Props) {
  const [content, setContent] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [terrain, setTerrain] = useState<Terrain | "">("");
  const [distance, setDistance] = useState<string>("");
  const [location, setLocation] = useState("");
  const [shoeLabel, setShoeLabel] = useState("");
  const [modelId, setModelId] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!draft) return;
    setContent(draft.content || "");
    setRating(draft.rating);
    setTerrain((draft.terrain as Terrain) || "");
    setDistance(draft.distance_km != null ? String(draft.distance_km) : "");
    setLocation(draft.location || "");
    setModelId(draft.model_id);
    setShoeLabel(
      draft.models
        ? `${draft.models.brands?.name || "—"} · ${draft.models.name}`
        : "—"
    );
    setSearch("");
    setResults([]);
  }, [draft]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (search.trim().length < 2) { setResults([]); return; }
      const { data } = await supabase
        .from("models")
        .select("id, name, brand:brands(id, name)")
        .ilike("name", `%${search.trim()}%`)
        .limit(8);
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const cleaned = content.replace(/\s*\[NEEDS SHOE IDENTIFICATION\]\s*/g, "").trim();
    const { error } = await supabase
      .from("reviews")
      .update({
        content: cleaned || null,
        model_id: modelId,
        rating: rating,
        terrain: terrain || null,
        distance_km: distance ? Number(distance) : null,
        location: location || null,
      })
      .eq("id", draft.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Draft updated");
    onSaved();
    onOpenChange(false);
  };

  if (!draft) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-none">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wider">
            Edit Draft
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider">Shoe</Label>
            <div className="text-sm border border-border p-2">{shoeLabel}</div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Reassign to another shoe…"
                className="pl-9 rounded-none"
              />
            </div>
            {results.length > 0 && (
              <div className="border border-border max-h-48 overflow-y-auto">
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setModelId(r.id);
                      setShoeLabel(`${r.brand?.name || "—"} · ${r.name}`);
                      setSearch("");
                      setResults([]);
                    }}
                    className="block w-full text-left text-sm px-3 py-2 hover:bg-muted"
                  >
                    {r.brand?.name || "—"} · {r.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider">Transcript</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="rounded-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider">Rating</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(rating === n ? null : n)}
                    className="p-1"
                  >
                    <Star
                      className={`h-6 w-6 ${
                        rating && n <= rating ? "fill-foreground" : "text-muted-foreground"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider">Terrain</Label>
              <Select value={terrain || undefined} onValueChange={(v) => setTerrain(v as Terrain)}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="road">Road</SelectItem>
                  <SelectItem value="trail">Trail</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                  <SelectItem value="track">Track</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider">Distance (km)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                className="rounded-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider">Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="rounded-none"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
