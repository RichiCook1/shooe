import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/landing/Navbar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { getStorageThumb } from "@/lib/imageCompression";
import { segmentLeadSentence, formatUpdated } from "@/lib/segmentStats";
import { itemListJsonLd } from "@/lib/jsonld";

const MIN_REVIEWS = 10;

const BestFor = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: segment, isLoading: segLoading } = useQuery({
    queryKey: ["segment", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data } = await supabase.from("segments").select("*").eq("slug", slug).maybeSingle();
      return data;
    },
    enabled: !!slug,
  });

  const { data: ranked } = useQuery({
    queryKey: ["segment-rank", slug],
    queryFn: async () => {
      if (!slug) return [];
      const { data: stats } = await supabase
        .from("model_segment_stats")
        .select("*")
        .eq("segment_slug", slug)
        .gte("review_count", MIN_REVIEWS)
        .order("avg_rating", { ascending: false })
        .limit(5);
      if (!stats || stats.length === 0) return [];
      const ids = stats.map((s: any) => s.model_id);
      const { data: models } = await supabase
        .from("models")
        .select("id, name, image_url, msrp, category, brand:brands(id, name)")
        .in("id", ids);
      const map = new Map((models ?? []).map((m: any) => [m.id, m]));
      return stats.map((s: any) => ({ ...s, model: map.get(s.model_id) })).filter((x: any) => x.model);
    },
    enabled: !!slug,
  });

  const { data: relatedSegments } = useQuery({
    queryKey: ["segments-related", segment?.category],
    queryFn: async () => {
      const { data } = await supabase
        .from("segments")
        .select("slug, title")
        .neq("slug", slug || "")
        .limit(8);
      return data ?? [];
    },
    enabled: !!segment,
  });

  if (segLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-12 max-w-4xl text-center">
          <p className="text-muted-foreground">Loading…</p>
        </main>
      </div>
    );
  }

  if (!segment) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-12 max-w-4xl text-center">
          <h1 className="text-2xl font-display font-bold mb-2">Segment not found</h1>
          <Link to="/feed" className="text-sm text-muted-foreground underline">Back to feed</Link>
        </main>
      </div>
    );
  }

  const canonical = `https://shoe-sherpa.com/best/${segment.slug}`;
  const top = ranked?.[0];
  const totalReviews = (ranked ?? []).reduce((sum: number, r: any) => sum + (r.review_count || 0), 0);
  const lead = segmentLeadSentence({
    segmentTitle: segment.title,
    reviewCount: totalReviews,
    topShoe: top ? [top.model.brand?.name, top.model.name].filter(Boolean).join(" ") : null,
    topShoePrice: top?.model?.msrp ?? null,
    topShoeRating: top?.avg_rating ?? null,
    topAttribute: null,
  });

  const jsonLd = itemListJsonLd({
    url: canonical,
    name: segment.title,
    items: (ranked ?? []).map((r: any) => ({
      url: `https://shoe-sherpa.com/model/${r.model.id}`,
      name: [r.model.brand?.name, r.model.name].filter(Boolean).join(" "),
      image: r.model.image_url,
    })),
  });

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{segment.title} | Shoe Sherpa</title>
        <meta name="description" content={lead.slice(0, 158)} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={segment.title} />
        <meta property="og:description" content={lead.slice(0, 158)} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <Navbar />
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Best for</p>
        <h1 className="text-3xl md:text-5xl font-display font-bold mt-1 mb-4">{segment.title}</h1>
        <p className="text-base md:text-lg text-foreground mb-2 leading-relaxed">{lead}</p>
        {segment.description && (
          <p className="text-sm text-muted-foreground mb-8">{segment.description}</p>
        )}

        {(!ranked || ranked.length === 0) ? (
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <p className="text-muted-foreground">
              We're still gathering enough verified reviews for this segment (minimum {MIN_REVIEWS} per shoe). Check back soon.
            </p>
          </div>
        ) : (
          <ol className="space-y-4">
            {ranked.map((r: any, i: number) => {
              const fullName = [r.model.brand?.name, r.model.name].filter(Boolean).join(" ");
              const evidence = `${fullName} — ${r.review_count} reviews from this segment, averaging ${Number(r.avg_rating).toFixed(1)}/10.`;
              return (
                <li key={r.model.id}>
                  <Link
                    to={`/model/${r.model.id}`}
                    className="flex gap-4 bg-card border border-border rounded-lg p-4 hover:border-foreground transition-colors"
                  >
                    <div className="text-3xl font-display font-bold text-muted-foreground w-10 shrink-0">{i + 1}</div>
                    {r.model.image_url ? (
                      <img
                        src={getStorageThumb(r.model.image_url, { width: 200, quality: 70, resize: "contain" }) || r.model.image_url}
                        alt={fullName}
                        className="w-20 h-20 object-contain bg-muted rounded shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-muted rounded shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h2 className="font-display text-lg font-semibold leading-tight">{fullName}</h2>
                      <p className="text-sm text-foreground mt-1">{evidence}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {r.model.category && (
                          <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0">
                            {String(r.model.category).replace(/_/g, " ")}
                          </Badge>
                        )}
                        {r.model.msrp && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">${r.model.msrp}</Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}

        {relatedSegments && relatedSegments.length > 0 && (
          <section className="mt-12 pt-8 border-t border-border">
            <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">Related guides</h3>
            <ul className="flex flex-wrap gap-2">
              {relatedSegments.map((s: any) => (
                <li key={s.slug}>
                  <Link to={`/best/${s.slug}`} className="text-sm px-3 py-1.5 border border-border rounded hover:border-foreground">
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-xs text-muted-foreground mt-8">Last updated {formatUpdated((segment as any).updated_at)}</p>
      </main>
    </div>
  );
};

export default BestFor;
