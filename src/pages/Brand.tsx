import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/landing/Navbar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { getStorageThumb } from "@/lib/imageCompression";
import { formatUpdated } from "@/lib/segmentStats";

const Brand = () => {
  const { brandId } = useParams<{ brandId: string }>();

  const { data: brand } = useQuery({
    queryKey: ["brand", brandId],
    queryFn: async () => {
      if (!brandId) return null;
      const { data } = await supabase.from("brands").select("*").eq("id", brandId).maybeSingle();
      return data;
    },
    enabled: !!brandId,
  });

  const { data: models } = useQuery({
    queryKey: ["brand-models", brandId],
    queryFn: async () => {
      if (!brandId) return [];
      const { data } = await supabase
        .from("models")
        .select("id, name, category, image_url, release_year, verified")
        .eq("brand_id", brandId)
        .order("name");
      return data ?? [];
    },
    enabled: !!brandId,
  });

  const canonical = `https://shoe-sherpa.com/brand/${brandId}`;
  const brandName = brand?.name ?? "Brand";
  const modelCount = models?.length ?? 0;
  const lead = modelCount > 0
    ? `${brandName} has ${modelCount} model${modelCount === 1 ? "" : "s"} reviewed by the Shoe Sherpa community.`
    : `${brandName} doesn't have community-reviewed shoes yet.`;
  const title = `${brandName} Running Shoes — Reviews & Models (2026) | Shoe Sherpa`;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={lead.slice(0, 158)} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={lead.slice(0, 158)} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
      </Helmet>
      <Navbar />
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <Link to="/feed" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Brand</p>
          <h1 className="text-4xl md:text-5xl font-display font-bold mt-1">{brandName}</h1>
          <p className="text-base text-foreground mt-3">{lead}</p>
          {(brand as any)?.notes && (
            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{(brand as any).notes}</p>
          )}
        </div>

        {models && models.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {models.map((m) => (
              <Link
                key={m.id}
                to={`/model/${m.id}`}
                className="group bg-card border border-border rounded-lg overflow-hidden hover:border-foreground transition-colors"
              >
                <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                  {m.image_url ? (
                    <img src={getStorageThumb(m.image_url, { width: 400, quality: 70, resize: "contain" }) || m.image_url} alt={m.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform" loading="lazy" decoding="async" />
                  ) : (
                    <span className="text-xs text-muted-foreground">No image</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-medium text-sm leading-tight line-clamp-2">{m.name}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {m.category && (
                      <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0">
                        {String(m.category).replace(/_/g, " ")}
                      </Badge>
                    )}
                    {m.release_year && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{m.release_year}</Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-12">No shoes yet for this brand.</p>
        )}

        <p className="text-xs text-muted-foreground mt-8">Last updated {formatUpdated((brand as any)?.updated_at)}</p>
      </main>
    </div>
  );
};

export default Brand;
