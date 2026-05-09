import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/landing/Navbar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { getStorageThumb } from "@/lib/imageCompression";

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <Link to="/feed" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Brand</p>
          <h1 className="text-4xl md:text-5xl font-display font-bold mt-1">{brand?.name ?? "…"}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {models?.length ?? 0} model{(models?.length ?? 0) === 1 ? "" : "s"}
          </p>
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
      </main>
    </div>
  );
};

export default Brand;
