import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/landing/Navbar";
import ReviewCard from "@/components/ReviewCard";
import ReviewDetailModal from "@/components/ReviewDetailModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getStorageThumb } from "@/lib/imageCompression";
import { shoeAggregateSentence, formatUpdated } from "@/lib/segmentStats";
import { productJsonLd } from "@/lib/jsonld";


const Model = () => {
  const { modelId } = useParams<{ modelId: string }>();
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [sort, setSort] = useState<"recent" | "rating">("recent");

  const { data: model } = useQuery({
    queryKey: ["model", modelId],
    queryFn: async () => {
      if (!modelId) return null;
      const { data } = await supabase
        .from("models")
        .select("*, brand:brands(id, name, logo_url)")
        .eq("id", modelId)
        .maybeSingle();
      return data;
    },
    enabled: !!modelId,
  });

  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ["model-summary", modelId],
    queryFn: async () => {
      if (!modelId) return null;
      const { data } = await supabase
        .from("model_summaries")
        .select("*")
        .eq("model_id", modelId)
        .maybeSingle();
      return data;
    },
    enabled: !!modelId,
  });

  const { data: reviews } = useQuery({
    queryKey: ["model-reviews", modelId, sort],
    queryFn: async () => {
      if (!modelId) return [];
      let q = supabase
        .from("reviews")
        .select(`*, model:models(id, name, category, brand_id, brand:brands(name))`)
        .eq("model_id", modelId);
      if (sort === "recent") q = q.order("created_at", { ascending: false });
      else q = q.order("rating", { ascending: false });
      const { data } = await q.limit(100);
      const list = data ?? [];
      const userIds = [...new Set(list.map((r: any) => r.user_id).filter(Boolean))];
      let map: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url")
          .in("user_id", userIds);
        map = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p]));
      }
      return list.map((r: any) => ({ ...r, profile: r.user_id ? map[r.user_id] || null : null }));
    },
    enabled: !!modelId,
  });

  // Trigger summary regeneration when count drifts
  useEffect(() => {
    if (!modelId || !reviews) return;
    if (reviews.length === 0) return;
    if (!summary || summary.review_count !== reviews.length) {
      supabase.functions.invoke("model-summary", { body: { modelId } }).then(() => refetchSummary());
    }
  }, [modelId, reviews, summary]);

  if (!model) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-12 max-w-4xl text-center">
          <p className="text-muted-foreground">Loading...</p>
        </main>
      </div>
    );
  }

  const topTagLabel = Array.isArray(summary?.top_tags) && (summary?.top_tags as any[])[0]?.label;
  const aggregateSentence = shoeAggregateSentence({
    brand: model.brand?.name ?? null,
    model: model.name,
    reviewCount: reviews?.length ?? summary?.review_count ?? 0,
    avgRating: summary?.avg_rating ?? null,
    topAttribute: topTagLabel || null,
  });
  const canonical = `https://shoe-sherpa.com/model/${model.id}`;
  const pageTitle = `${[model.brand?.name, model.name].filter(Boolean).join(" ")} Review (2026) — Shoe Sherpa`;
  const pageDescription = aggregateSentence.slice(0, 158);
  const updatedAt = model.updated_at || summary?.updated_at || new Date().toISOString();

  const jsonLd = productJsonLd({
    url: canonical,
    name: [model.brand?.name, model.name].filter(Boolean).join(" "),
    brand: model.brand?.name,
    image: model.image_url || undefined,
    description: aggregateSentence,
    category: model.category ? String(model.category).replace(/_/g, " ") : undefined,
    msrp: model.msrp,
    avgRating: summary?.avg_rating,
    reviewCount: reviews?.length ?? summary?.review_count ?? 0,
    reviews: (reviews ?? []).map((r: any) => ({
      author: r.profile?.display_name || r.profile?.username || null,
      rating: r.rating,
      body: r.content,
      date: r.created_at,
    })),
    dateModified: updatedAt,
  });

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="product" />
        {model.image_url && <meta property="og:image" content={model.image_url} />}
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <Navbar />
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Link to="/feed" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to feed
        </Link>

        {/* Answer-first lead — quotable by AI crawlers */}
        <p className="text-base md:text-lg text-foreground mb-6 leading-relaxed">{aggregateSentence}</p>


        {/* Header */}
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          {model.image_url && (
            <img src={getStorageThumb(model.image_url, { width: 600, quality: 75, resize: "contain" }) || model.image_url} alt={model.name} className="w-full md:w-64 max-h-64 object-contain bg-muted rounded-lg" decoding="async" />
          )}
          <div className="flex-1">
            {model.brand?.id ? (
              <Link to={`/brand/${model.brand.id}`} className="text-sm text-muted-foreground uppercase tracking-wide hover:text-foreground">
                {model.brand.name}
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground uppercase tracking-wide">{model.brand?.name}</p>
            )}
            <h1 className="text-4xl font-display font-bold mt-1 mb-3">{model.name}</h1>
            <div className="flex flex-wrap gap-2 mb-4">
              {model.category && <Badge variant="outline" className="capitalize">{String(model.category).replace(/_/g, " ")}</Badge>}
              {model.release_year && <Badge variant="secondary">{model.release_year}</Badge>}
              {model.weight_g && <Badge variant="secondary">{model.weight_g}g</Badge>}
              {model.drop_mm != null && <Badge variant="secondary">{model.drop_mm}mm drop</Badge>}
              {model.stack_height_mm && <Badge variant="secondary">{model.stack_height_mm}mm stack</Badge>}
              {model.msrp && <Badge variant="secondary">${model.msrp}</Badge>}
            </div>
            {model.pending_review && (
              <p className="text-xs text-muted-foreground italic">Pending verification by admin.</p>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Average score</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold font-display text-primary">
                  {summary?.avg_rating != null ? Number(summary.avg_rating).toFixed(1) : reviews && reviews.length > 0 ? "…" : "–"}
                </span>
                <span className="text-sm text-muted-foreground">/10</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{reviews?.length ?? 0} review{(reviews?.length ?? 0) === 1 ? "" : "s"}</p>
            </div>
          </div>
          {summary?.summary && (
            <div className="flex gap-2 items-start mt-3 pt-3 border-t border-border">
              <Sparkles className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <p className="text-sm text-foreground">{summary.summary}</p>
            </div>
          )}
          {summary?.top_tags && Array.isArray(summary.top_tags) && summary.top_tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {(summary.top_tags as any[]).map((t, i) => (
                <Badge key={i} variant={t.type === "negative" ? "destructive" : "secondary"} className="text-xs">
                  {t.label} · {t.count}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">Sort:</span>
          <Button size="sm" variant={sort === "recent" ? "default" : "ghost"} onClick={() => setSort("recent")}>Recent</Button>
          <Button size="sm" variant={sort === "rating" ? "default" : "ghost"} onClick={() => setSort("rating")}>Top rated</Button>
        </div>

        {/* Reviews */}
        {reviews && reviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map((r: any) => (
              <ReviewCard key={r.id} review={r} onClick={() => setSelectedReview(r)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No reviews yet for this shoe.</p>
            <Link to="/review"><Button className="mt-4">Be the first to review</Button></Link>
          </div>
        )}

        <ReviewDetailModal review={selectedReview} open={!!selectedReview} onOpenChange={(o) => !o && setSelectedReview(null)} />
      </main>
    </div>
  );
};

export default Model;
