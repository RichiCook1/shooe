import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Check, SkipForward } from "lucide-react";
import { toast } from "sonner";

interface QueueInfo {
  index: number; // 0-based
  total: number;
  onNext: () => void;
  onSkip: () => void;
}

interface Props {
  reviewId: string;
  photoUrl: string;
  currentContent: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApplied: () => void;
  queueInfo?: QueueInfo;
}

interface Candidate {
  brand: string;
  model: string;
  confidence: number | null;
  reason: string | null;
  brandMatch: { id: string; name: string } | null;
  modelMatch: { id: string; name: string; image_url?: string | null } | null;
}

const stripMarker = (s: string | null) =>
  (s || "").replace(/\n*\[NEEDS SHOE IDENTIFICATION\]/g, "").trim();

export async function applyIdentification(
  reviewId: string,
  modelId: string,
  currentContent: string | null
) {
  const cleaned = stripMarker(currentContent);
  const { error } = await supabase
    .from("reviews")
    .update({ model_id: modelId, content: cleaned || null })
    .eq("id", reviewId);
  if (error) throw error;
}

export async function identifyFromUrl(imageUrl: string): Promise<Candidate[]> {
  // Prefer Google Lens (via SerpAPI) — far more accurate than vision-only.
  const lens = await supabase.functions.invoke("identify-shoe-from-lens", {
    body: { imageUrl, topK: 4 },
  });
  if (!lens.error && (lens.data?.candidates as Candidate[])?.length) {
    return lens.data.candidates as Candidate[];
  }
  // Fallback to vision model if Lens returns nothing.
  const { data, error } = await supabase.functions.invoke("identify-shoe-from-image", {
    body: { imageUrl, topK: 4 },
  });
  if (error) throw error;
  return (data?.candidates as Candidate[]) || [];
}


export default function IdentifyShoeDialog({
  reviewId,
  photoUrl,
  currentContent,
  open,
  onOpenChange,
  onApplied,
  queueInfo,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Manual fallback
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [manualBrand, setManualBrand] = useState("");
  const [manualModel, setManualModel] = useState("");
  const [manualBusy, setManualBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCandidates([]);
    setSearch("");
    setResults([]);
    setManualBrand("");
    setManualModel("");
    setLoading(true);
    identifyFromUrl(photoUrl)
      .then(setCandidates)
      .catch((e) => toast.error(e.message || "Identification failed"))
      .finally(() => setLoading(false));
  }, [open, photoUrl]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (search.trim().length < 2) {
        setResults([]);
        return;
      }
      const { data } = await supabase
        .from("models")
        .select("id, name, brand:brands(name)")
        .ilike("name", `%${search.trim()}%`)
        .limit(8);
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  const finishOne = () => {
    onApplied();
    if (queueInfo) queueInfo.onNext();
    else onOpenChange(false);
  };

  const useCandidate = async (c: Candidate, key: string) => {
    setBusyId(key);
    try {
      let modelId = c.modelMatch?.id ?? null;
      if (!modelId) {
        if (!c.brand || !c.model) throw new Error("Missing brand/model");
        const { data, error } = await supabase.functions.invoke("validate-shoe-name", {
          body: { brand: c.brand, model: c.model, brandId: c.brandMatch?.id },
        });
        if (error) throw error;
        modelId = data?.modelId ?? null;
      }
      if (!modelId) throw new Error("Could not resolve model");
      await applyIdentification(reviewId, modelId, currentContent);
      toast.success("Identified & re-linked");
      finishOne();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const usePicked = async (modelId: string) => {
    setBusyId(modelId);
    try {
      await applyIdentification(reviewId, modelId, currentContent);
      toast.success("Re-linked");
      finishOne();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const useManual = async () => {
    if (!manualBrand.trim() || !manualModel.trim()) {
      toast.error("Enter brand and model");
      return;
    }
    setManualBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-shoe-name", {
        body: { brand: manualBrand.trim(), model: manualModel.trim() },
      });
      if (error) throw error;
      if (!data?.modelId) throw new Error("Could not create model");
      await applyIdentification(reviewId, data.modelId, currentContent);
      toast.success("Created & re-linked");
      finishOne();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setManualBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wider text-lg">
            Identify shoe from photo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <img
            src={photoUrl}
            alt="Shoe"
            className="w-full max-h-64 object-contain bg-muted border border-border"
          />

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing image…
            </div>
          ) : (
            <>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> AI candidates
                </div>
                {candidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No candidates found.</p>
                ) : (
                  <ul className="space-y-2">
                    {candidates.map((c, i) => {
                      const key = `c${i}`;
                      const conf = c.confidence != null ? Math.round(c.confidence * 100) : null;
                      return (
                        <li
                          key={key}
                          className="border border-border p-3 flex gap-3 items-start"
                        >
                          {c.modelMatch?.image_url && (
                            <img
                              src={c.modelMatch.image_url}
                              alt=""
                              className="w-16 h-16 object-cover bg-muted flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">
                                {c.brand} · {c.model}
                              </span>
                              {conf != null && (
                                <Badge variant="outline" className="rounded-none text-xs">
                                  {conf}%
                                </Badge>
                              )}
                              {c.modelMatch && (
                                <Badge variant="secondary" className="rounded-none text-xs">
                                  In catalog
                                </Badge>
                              )}
                            </div>
                            {c.reason && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {c.reason}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            disabled={busyId === key}
                            onClick={() => useCandidate(c, key)}
                          >
                            {busyId === key ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-3 w-3 mr-1" /> Use
                              </>
                            )}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="pt-2 border-t border-border space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Or pick from catalog
                </div>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search model name…"
                  className="rounded-none"
                />
                {results.length > 0 && (
                  <ul className="border border-border max-h-48 overflow-auto">
                    {results.map((r) => (
                      <li key={r.id} className="flex items-center justify-between p-2 hover:bg-accent">
                        <div className="text-sm">
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.brand?.name}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === r.id}
                          onClick={() => usePicked(r.id)}
                        >
                          {busyId === r.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Use"
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="pt-2 border-t border-border space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Or type it manually
                </div>
                <div className="flex gap-2">
                  <Input
                    value={manualBrand}
                    onChange={(e) => setManualBrand(e.target.value)}
                    placeholder="Brand"
                    className="rounded-none"
                  />
                  <Input
                    value={manualModel}
                    onChange={(e) => setManualModel(e.target.value)}
                    placeholder="Model"
                    className="rounded-none"
                  />
                  <Button onClick={useManual} disabled={manualBusy}>
                    {manualBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
