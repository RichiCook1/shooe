import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import { formatLocationCityCountry } from "@/lib/imageCompression";

const CATEGORY_LABELS: Record<string, string> = {
  road: "Road", trail: "Trail", track: "Track", racing: "Racing",
  indoor_climbing: "Indoor Climbing", outdoor_climbing: "Outdoor Climbing",
  mountaineering: "Mountaineering", hiking: "Hiking", recovery: "Recovery",
  cross_training: "Cross Training", walking: "Walking",
};

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

      // Get profiles
      const userIds = [...new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean))];
      let profileMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url")
          .in("user_id", userIds);
        profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p]));
      }

      return (data ?? []).map((r: any) => ({
        ...r,
        profile: r.user_id ? profileMap[r.user_id] || null : null,
      }));
    },
  });

  if (isLoading) {
    return (
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-xl" />
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
          {reviews?.slice(0, 6).map((review: any, index: number) => {
            const model = review.model as any;
            const brand = model?.brand as any;
            const brandModel = [brand?.name, model?.name].filter(Boolean).join(" ");
            const images = review.media_urls ?? [];
            const displayName = review.profile?.display_name || review.profile?.username || null;
            const avatar = review.profile?.avatar_url;
            const categoryLabel = model?.category ? CATEGORY_LABELS[model.category] : null;
            const locationDisplay = formatLocationCityCountry(review.location);

            return (
              <article
                key={review.id}
                className="bg-card rounded-xl overflow-hidden shadow-[var(--shadow-card)] animate-slide-up"
                style={{ animationDelay: `${index * 0.06}s` }}
              >
                {images.length > 0 && (
                  <div className="relative overflow-hidden">
                    <img
                      src={images[0]}
                      alt={brandModel}
                      className="w-full object-contain max-h-[280px]"
                      loading="lazy"
                    />
                    {review.rating != null && (
                      <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm rounded-lg px-2.5 py-1 shadow-sm">
                        <span className="text-lg font-bold font-display text-primary">{review.rating}</span>
                        <span className="text-xs text-muted-foreground">/10</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="p-4 space-y-2">
                  {displayName && (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {avatar ? (
                          <img src={avatar} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <span className="text-[10px] font-bold text-muted-foreground">{displayName[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate">{displayName}</span>
                    </div>
                  )}
                  <h3 className="font-display font-bold text-lg">{brandModel || "Unknown Shoe"}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {categoryLabel && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 border border-border rounded">{categoryLabel}</span>
                    )}
                    {locationDisplay && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{locationDisplay}
                      </span>
                    )}
                  </div>
                  {review.content && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{review.content}</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <Link to="/login?mode=signup">
            <Button size="lg" className="h-12 px-10 text-sm uppercase tracking-wider font-medium">
              Sign Up to See More
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FeaturedReviews;
