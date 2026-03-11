import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, ArrowRight, Mountain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { formatLocationCityCountry } from "@/lib/imageCompression";
import StatsSection from "./StatsSection";

const FeaturedReviews = () => {
  const { data: reviews, isLoading } = useQuery({
    queryKey: ["featured-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(`
          id, content, distance_km, location, terrain, rating, created_at, media_urls,
          model:models!inner(name, category, brand:brands!inner(name))
        `)
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

  return (
    <section className="min-h-[calc(100vh-3rem)]">
      <div className="container mx-auto px-4 py-16">
        {/* Mobile: stacked, Desktop: side-by-side */}
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-12">
          {/* LEFT — Hero */}
          <div className="lg:w-[38%] flex flex-col justify-between shrink-0">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-6 animate-fade-in">
                Running shoe reviews
              </p>

              <h1 className="text-6xl md:text-7xl lg:text-8xl font-display uppercase tracking-wide leading-[0.9] mb-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>
                Find Your
                <br />
                Perfect
                <br />
                Shoe
              </h1>

              <p className="text-base text-muted-foreground max-w-md mb-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
                Real reviews from real runners. No fluff, no sponsored content — just honest miles logged.
              </p>

              <div className="flex items-center gap-4 animate-fade-in" style={{ animationDelay: "0.3s" }}>
                <Link to="/review">
                  <Button size="lg" className="h-12 px-8 text-sm uppercase tracking-wider font-medium">
                    Write a Review
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" size="lg" className="h-12 px-8 text-sm uppercase tracking-wider font-medium">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>

            {/* Stats inline under hero on desktop */}
            <div className="mt-12 lg:mt-16">
              <StatsSection inline />
            </div>
          </div>

          {/* RIGHT — Latest Reviews */}
          <div className="lg:w-[62%]">
            <div className="mb-8">
              <h2 className="text-4xl md:text-5xl font-display uppercase tracking-wide mb-1">
                Latest Reviews
              </h2>
              <p className="text-muted-foreground text-sm">
                Real runners. Real opinions.
              </p>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-48 bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reviews?.map((review: any, index: number) => {
                  const model = review.model as any;
                  const brand = model?.brand as any;
                  const tags = getTagsForReview(review.id);
                  const locationDisplay = formatLocationCityCountry(review.location);

                    const images = review.media_urls ?? [];

                    return (
                    <article
                      key={review.id}
                      className="group border border-border overflow-hidden hover:bg-muted/50 transition-colors animate-slide-up"
                      style={{ animationDelay: `${index * 0.06}s` }}
                    >
                      {images.length > 0 && (
                        <img
                          src={images[0]}
                          alt={model?.name}
                          className="w-full h-40 object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="p-5">
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

                      {review.content && (
                        <p className="text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-2">
                          {review.content}
                        </p>
                      )}

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
                        {locationDisplay && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {locationDisplay}
                          </span>
                        )}
                      </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="text-center mt-8">
              <Link to="/login?mode=signup">
                <Button variant="outline" size="lg" className="h-12 px-10 text-sm uppercase tracking-wider font-medium">
                  Sign Up to See More
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturedReviews;
