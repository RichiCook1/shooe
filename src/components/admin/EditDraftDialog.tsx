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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Star, Sparkles, Undo2, Loader2, Camera } from "lucide-react";

type Terrain = "road" | "trail" | "mixed" | "track";

export interface DraftReviewLite {
  id: string;
  content: string | null;
  model_id: string;
  rating: number | null;
  terrain: Terrain | null;
  distance_km: number | null;
  location: string | null;
  raw_transcript?: string | null;
  content_en?: string | null;
  original_language?: string | null;
  cleaned_at?: string | null;
  ai_suggestions?: any;
  media_urls?: string[] | null;
  models: { id: string; name: string; brands: { id: string; name: string } | null } | null;
}

interface DetectCandidate {
  brand: string;
  model: string;
  confidence: number | null;
  reason: string | null;
  brandMatch: { id: string; name: string } | null;
  modelMatch: { id: string; name: string; image_url?: string | null } | null;
}

interface Props {
  draft: DraftReviewLite | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

export function EditDraftDialog({ draft, open, onOpenChange, onSaved }: Props) {
  const [content, setContent] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [rawTranscript, setRawTranscript] = useState("");
  const [language, setLanguage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ rating?: number | null; terrain?: string | null; tag_ids?: string[] } | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [terrain, setTerrain] = useState<Terrain | "">("");
  const [distance, setDistance] = useState<string>("");
  const [location, setLocation] = useState("");
  const [shoeLabel, setShoeLabel] = useState("");
  const [modelId, setModelId] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectCandidate[] | null>(null);

  useEffect(() => {
    if (!draft) return;
    setContent(draft.content || "");
    setContentEn(draft.content_en || "");
    setRawTranscript(draft.raw_transcript || "");
    setLanguage(draft.original_language || null);
    setSuggestions(draft.ai_suggestions || null);
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
    setDetected(null);
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

  const reclean = async () => {
    const source = rawTranscript || content;
    if (!source.trim()) { toast.error("Nothing to clean"); return; }
    if (content && !confirm("Overwrite the current cleaned text with a fresh AI version?")) return;
    setCleaning(true);
    try {
      const { data, error } = await supabase.functions.invoke("normalize-interview", {
        body: { transcript: source },
      });
      if (error) throw error;
      setContent(data?.content_cleaned || source);
      setContentEn(data?.content_en || "");
      setLanguage(data?.language || null);
      setSuggestions({
        rating: data?.rating ?? null,
        terrain: data?.terrain ?? null,
        tag_ids: data?.tag_ids ?? [],
      });
      if (!rawTranscript) setRawTranscript(source);
      toast.success("Re-cleaned with AI");
    } catch (e: any) {
      toast.error(e.message || "Cleanup failed");
    } finally {
      setCleaning(false);
    }
  };

  const revertToRaw = () => {
    if (!rawTranscript) { toast.error("No raw transcript stored"); return; }
    if (!confirm("Replace cleaned content with the raw transcript?")) return;
    setContent(rawTranscript);
  };

  const detectShoe = async () => {
    const photo = draft?.media_urls?.[0];
    if (!photo) { toast.error("No photo on this review"); return; }
    setDetecting(true);
    setDetected(null);
    try {
      const { data, error } = await supabase.functions.invoke("identify-shoe-from-image", {
        body: { imageUrl: photo, topK: 3 },
      });
      if (error) throw error;
      const cands: DetectCandidate[] = Array.isArray(data?.candidates) ? data.candidates : [];
      if (!cands.length) { toast.error("Couldn't identify a shoe from this photo"); return; }
      setDetected(cands);
    } catch (e: any) {
      toast.error(e.message || "Detection failed");
    } finally {
      setDetecting(false);
    }
  };

  const pickDetected = async (c: DetectCandidate) => {
    try {
      let brandId = c.brandMatch?.id ?? null;
      let brandName = c.brandMatch?.name ?? c.brand;
      if (!brandId && c.brand) {
        const { data: existing } = await supabase.from("brands").select("id, name").ilike("name", c.brand).maybeSingle();
        if (existing) { brandId = existing.id; brandName = existing.name; }
        else {
          const { data: nb, error } = await supabase.from("brands").insert({ name: c.brand }).select("id, name").single();
          if (error) throw error;
          brandId = nb.id; brandName = nb.name;
        }
      }
      let modelMatchId = c.modelMatch?.id ?? null;
      let modelName = c.modelMatch?.name ?? c.model;
      if (!modelMatchId && brandId && c.model) {
        const { data: existingM } = await supabase.from("models")
          .select("id, name").eq("brand_id", brandId).ilike("name", c.model).maybeSingle();
        if (existingM) { modelMatchId = existingM.id; modelName = existingM.name; }
        else {
          const { data: nm, error } = await supabase.from("models")
            .insert({ name: c.model, brand_id: brandId, pending_review: true })
            .select("id, name").single();
          if (error) throw error;
          modelMatchId = nm.id; modelName = nm.name;
        }
      }
      if (!modelMatchId) { toast.error("Couldn't resolve a model"); return; }
      setModelId(modelMatchId);
      setShoeLabel(`${brandName || "—"} · ${modelName}`);
      setDetected(null);
      toast.success("Shoe assigned — remember to Save");
    } catch (e: any) {
      toast.error(e.message || "Couldn't assign shoe");
    }
  };


  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const cleaned = content.replace(/\s*\[NEEDS SHOE IDENTIFICATION\]\s*/g, "").trim();
    const { error } = await supabase
      .from("reviews")
      .update({
        content: cleaned || null,
        content_en: contentEn.trim() || null,
        raw_transcript: rawTranscript.trim() || null,
        original_language: language,
        cleaned_at: new Date().toISOString(),
        ai_suggestions: suggestions,
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

  const sRating = suggestions?.rating;
  const sTerrain = suggestions?.terrain;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-none">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wider flex items-center gap-2">
            Edit Draft
            {language && <Badge variant="secondary" className="rounded-none text-xs uppercase">{language}</Badge>}
            {!draft.cleaned_at && <Badge variant="outline" className="rounded-none text-xs">Needs cleanup</Badge>}
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
            {draft?.media_urls && draft.media_urls.length > 0 && (
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-none text-xs uppercase tracking-wider"
                  onClick={detectShoe}
                  disabled={detecting}
                >
                  {detecting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Camera className="h-3 w-3 mr-1" />}
                  Detect shoe from photo
                </Button>
              </div>
            )}
            {detected && detected.length > 0 && (
              <div className="border border-border divide-y divide-border">
                <div className="text-xs uppercase tracking-wider text-muted-foreground px-3 py-2 bg-muted">
                  Top {detected.length} matches — pick one
                </div>
                {detected.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pickDetected(c)}
                    className="flex w-full items-center gap-3 text-left px-3 py-2 hover:bg-muted"
                  >
                    {c.modelMatch?.image_url ? (
                      <img src={c.modelMatch.image_url} alt="" className="h-10 w-10 object-cover" />
                    ) : (
                      <div className="h-10 w-10 bg-muted flex items-center justify-center">
                        <Camera className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {c.brand} · {c.model}
                      </div>
                      {c.reason && (
                        <div className="text-xs text-muted-foreground truncate">{c.reason}</div>
                      )}
                    </div>
                    <div className="text-xs tabular-nums text-muted-foreground">
                      {c.confidence != null ? `${Math.round(c.confidence * 100)}%` : ""}
                      {!c.modelMatch && (
                        <span className="ml-1 uppercase">· new</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider">Review text</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={reclean} disabled={cleaning}>
                  {cleaning ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  Re-clean with AI
                </Button>
                {rawTranscript && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={revertToRaw}>
                    <Undo2 className="h-3 w-3 mr-1" />
                    Revert to raw
                  </Button>
                )}
              </div>
            </div>
            <Tabs defaultValue="cleaned">
              <TabsList className="rounded-none">
                <TabsTrigger value="cleaned" className="rounded-none">Cleaned</TabsTrigger>
                <TabsTrigger value="english" className="rounded-none">English</TabsTrigger>
                <TabsTrigger value="raw" className="rounded-none">Raw transcript</TabsTrigger>
              </TabsList>
              <TabsContent value="cleaned">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  className="rounded-none"
                />
              </TabsContent>
              <TabsContent value="english">
                <Textarea
                  value={contentEn}
                  onChange={(e) => setContentEn(e.target.value)}
                  rows={8}
                  placeholder="English translation"
                  className="rounded-none"
                />
              </TabsContent>
              <TabsContent value="raw">
                <Textarea
                  value={rawTranscript}
                  onChange={(e) => setRawTranscript(e.target.value)}
                  rows={8}
                  placeholder="Original verbatim transcript"
                  className="rounded-none font-mono text-xs"
                />
              </TabsContent>
            </Tabs>
          </div>

          {(sRating != null || sTerrain) && (
            <div className="border border-border p-2 space-y-1.5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">AI suggestions</div>
              <div className="flex flex-wrap gap-2">
                {sRating != null && (
                  <button
                    type="button"
                    onClick={() => setRating(sRating as number)}
                    className="text-xs px-2 py-1 border border-border hover:bg-muted"
                  >
                    Apply rating {Number(sRating).toFixed(1)}
                  </button>
                )}
                {sTerrain && (
                  <button
                    type="button"
                    onClick={() => setTerrain(sTerrain as Terrain)}
                    className="text-xs px-2 py-1 border border-border hover:bg-muted capitalize"
                  >
                    Apply terrain: {sTerrain}
                  </button>
                )}
              </div>
            </div>
          )}

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
