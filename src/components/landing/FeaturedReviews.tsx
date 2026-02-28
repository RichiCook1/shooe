import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star, MapPin, Mountain } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const FeaturedReviews = () => {
  const { data: reviews, isLoading } = useQuery({
    queryKey: ["featured-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(`
          id, content, distance_km, location, terrain, created_at,
          models!inner(name, category, brands!inner(name))
        `)
        .not("content", "is", null)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  // Also fetch tags for these reviews
  const reviewIds = reviews?.map((r) => r.id) ?? [];
  const { data: reviewTags } = useQuery({
    queryKey: ["featured-review-tags", reviewIds],
    queryFn: async () => {
      if (reviewIds.length === 0) return [];
      const { data, error } = await supabase
        .from("review_tags")
        .select("review_id, tags(label, type)")
        .in("review_id", reviewIds);
      if (error) throw error;
      return data;
    },
    enabled: reviewIds.length > 0,
  });

  const getTagsForReview = (reviewId: string) => {
    return reviewTags?.filter((rt) => rt.review_id === reviewId) ?? [];
  };

  const terrainIcon = (terrain: string | null) => {
    if (terrain === "trail") return <Mountain className="w-3.5 h-3.5" />;
    return null;
  };

  if (isLoading) {
    return (
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold font-display mb-3">
            Latest Reviews
          </h2>
          <p className="text-muted-foreground text-lg">
            Real runners. Real opinions. Real miles.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews?.map((review, index) => {
            const model = review.models as any;
            const brand = model?.brands as any;
            const tags = getTagsForReview(review.id);

            return (
              <article
                key={review.id}
                className="group bg-card rounded-xl border border-border p-6 hover:shadow-lg transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                {/* Shoe info header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs font-medium text-primary uppercase tracking-wider">
                      {brand?.name}
                    </p>
                    <h3 className="text-lg font-bold font-display">
                      {model?.name}
                    </h3>
                  </div>
                  {review.distance_km && (
                    <Badge variant="secondary" className="text-xs">
                      {review.distance_km}km
                    </Badge>
                  )}
                </div>

                {/* Review content */}
                <p className="text-muted-foreground text-sm leading-relaxed mb-4 line-clamp-3">
                  {review.content}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {tags.slice(0, 4).map((rt: any, i: number) => (
                    <Badge
                      key={i}
                      variant={rt.tags?.type === "positive" ? "default" : "destructive"}
                      className={`text-xs ${rt.tags?.type === "positive" ? "bg-success/15 text-success hover:bg-success/20 border-0" : "bg-destructive/15 text-destructive hover:bg-destructive/20 border-0"}`}
                    >
                      {rt.tags?.label}
                    </Badge>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-3 border-t border-border">
                  {review.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {review.location}
                    </span>
                  )}
                  {review.terrain && (
                    <span className="flex items-center gap-1 capitalize">
                      {terrainIcon(review.terrain)}
                      {review.terrain}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturedReviews;
