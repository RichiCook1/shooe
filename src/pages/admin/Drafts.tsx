import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Trash2, AlertCircle, ExternalLink, Search, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { EditDraftDialog, DraftReviewLite } from "@/components/admin/EditDraftDialog";

interface DraftReview {
  id: string;
  content: string | null;
  media_urls: string[] | null;
  created_at: string;
  guest_session_id: string | null;
  model_id: string;
  rating: number | null;
  terrain: "road" | "trail" | "mixed" | "track" | null;
  distance_km: number | null;
  location: string | null;
  raw_transcript: string | null;
  content_en: string | null;
  original_language: string | null;
  cleaned_at: string | null;
  ai_suggestions: any;
  models: {
    id: string;
    name: string;
    pending_review: boolean;
    brands: { id: string; name: string } | null;
  } | null;
}

export default function AdminDrafts() {
  const [drafts, setDrafts] = useState<DraftReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [onlyNeedsId, setOnlyNeedsId] = useState(false);
  const [editing, setEditing] = useState<DraftReviewLite | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reviews")
      .select("id, content, media_urls, created_at, guest_session_id, model_id, rating, terrain, distance_km, location, raw_transcript, content_en, original_language, cleaned_at, ai_suggestions")
      .like("guest_session_id", "interview:%")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const reviews = data || [];
    const modelIds = Array.from(new Set(reviews.map((r) => r.model_id).filter(Boolean)));
    let modelsMap = new Map<string, any>();
    let brandsMap = new Map<string, any>();
    if (modelIds.length) {
      const { data: models } = await supabase
        .from("models")
        .select("id, name, pending_review, brand_id")
        .in("id", modelIds);
      (models || []).forEach((m) => modelsMap.set(m.id, m));
      const brandIds = Array.from(new Set((models || []).map((m) => m.brand_id).filter(Boolean)));
      if (brandIds.length) {
        const { data: brands } = await supabase
          .from("brands")
          .select("id, name")
          .in("id", brandIds);
        (brands || []).forEach((b) => brandsMap.set(b.id, b));
      }
    }
    const enriched: DraftReview[] = reviews.map((r) => {
      const m = modelsMap.get(r.model_id);
      return {
        ...r,
        models: m
          ? {
              id: m.id,
              name: m.name,
              pending_review: m.pending_review,
              brands: brandsMap.get(m.brand_id) || null,
            }
          : null,
      } as DraftReview;
    });
    setDrafts(enriched);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string) => {
    if (!confirm("Delete this draft?")) return;
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      toast.success("Draft deleted");
    }
  };

  const filtered = drafts.filter((d) => {
    if (onlyNeedsId) {
      const needs =
        (d.content || "").includes("[NEEDS SHOE IDENTIFICATION]") ||
        d.models?.brands?.name?.toLowerCase() === "unknown";
      if (!needs) return false;
    }
    if (!filter) return true;
    const hay = [
      d.content || "",
      d.models?.name || "",
      d.models?.brands?.name || "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(filter.toLowerCase());
  });

  const needsCount = drafts.filter(
    (d) =>
      (d.content || "").includes("[NEEDS SHOE IDENTIFICATION]") ||
      d.models?.brands?.name?.toLowerCase() === "unknown"
  ).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display tracking-wider uppercase">Interview Drafts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {drafts.length} total · {needsCount} need shoe identification
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search transcript, brand, model…"
            className="pl-9 rounded-none"
          />
        </div>
        <Button
          variant={onlyNeedsId ? "default" : "outline"}
          size="sm"
          onClick={() => setOnlyNeedsId((v) => !v)}
        >
          <AlertCircle className="h-4 w-4 mr-1" />
          Needs ID only
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 rounded-none border-border text-center text-sm text-muted-foreground">
          No drafts found.
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => {
            const needsId =
              (d.content || "").includes("[NEEDS SHOE IDENTIFICATION]") ||
              d.models?.brands?.name?.toLowerCase() === "unknown";
            const photo = d.media_urls?.[0];
            return (
              <Card key={d.id} className="p-4 rounded-none border-border flex gap-4">
                {photo ? (
                  <img
                    src={photo}
                    alt="Shoe"
                    className="w-24 h-24 object-cover bg-muted flex-shrink-0"
                  />
                ) : (
                  <div className="w-24 h-24 bg-muted flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-display uppercase tracking-wide text-sm truncate">
                        {d.models?.brands?.name || "—"} · {d.models?.name || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {needsId && (
                        <Badge variant="destructive" className="rounded-none text-xs">
                          Needs ID
                        </Badge>
                      )}
                      {!d.cleaned_at && (
                        <Badge variant="outline" className="rounded-none text-xs">
                          Needs cleanup
                        </Badge>
                      )}
                      {d.original_language && d.original_language !== "en" && (
                        <Badge variant="secondary" className="rounded-none text-xs uppercase">
                          {d.original_language}
                        </Badge>
                      )}
                      {d.models?.pending_review && !needsId && (
                        <Badge variant="secondary" className="rounded-none text-xs">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                    {d.content || <em className="italic">No transcript</em>}
                  </p>
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() =>
                        setEditing({
                          id: d.id,
                          content: d.content,
                          model_id: d.model_id,
                          rating: d.rating,
                          terrain: d.terrain,
                          distance_km: d.distance_km,
                          location: d.location,
                          models: d.models
                            ? { id: d.models.id, name: d.models.name, brands: d.models.brands }
                            : null,
                        })
                      }
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    {d.model_id && (
                      <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                        <Link to={`/model/${d.model_id}`}>
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Model
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => remove(d.id)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <EditDraftDialog
        draft={editing}
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        onSaved={load}
      />
    </div>
  );
}
