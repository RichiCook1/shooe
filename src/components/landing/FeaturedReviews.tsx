import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin } from "lucide-react";

const FeaturedReviews = () => {
  const { data: reviews, isLoading } = useQuery({
    queryKey: ["featured-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(`
          id, content, distance_km, location, terrain, rating, created_at,
          models!inner(name, category, brands!inner(name))
        `)
        .not("content", "is", null)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

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

  const getTagsForReview = (reviewId: string) =>
    reviewTags?.filter((rt) => rt.review_id === reviewId) ?? [];

  if (isLoading) {
    return (
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="mb-12">
          <h2 className="text-4xl md:text-5xl font-display uppercase tracking-wide mb-2">
            Latest Reviews
          </h2>
          <p className="text-muted-foreground text-sm">
            Real runners. Real opinions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews?.map((review, index) => {
            const model = review.models as any;
            const brand = model?.brands as any;
            const tags = getTagsForReview(review.id);

            return (
              <article
                key={review.id}
                className="group border border-border p-5 hover:bg-muted/50 transition-colors animate-slide-up"
                style={{ animationDelay: `${index * 0.06}s` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      {brand?.name}
                    </p>
                    <h3 className="text-lg font-display uppercase tracking-wide">
                      {model?.name}
                    </h3>
                  </div>
                  {review.rating != null && (
                    <span className="text-2xl font-display">{review.rating}</span>
                  )}
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-2">
                  {review.content}
                </p>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {tags.slice(0, 3).map((rt: any, i: number) => (
                      <span
                        key={i}
                        className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${
                          rt.tags?.type === "positive"
                            ? "border-foreground/20 text-foreground"
                            : "border-destructive/30 text-destructive"
                        }`}
                      >
                        {rt.tags?.label}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {review.terrain && <span className="capitalize">{review.terrain}</span>}
                  {review.distance_km && <span>{review.distance_km} km</span>}
                  {review.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {review.location}
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
