import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/landing/Navbar";
import ReviewCard from "@/components/ReviewCard";
import ReviewDetailModal from "@/components/ReviewDetailModal";
import UserSearch from "@/components/UserSearch";
import FeedFilters from "@/components/FeedFilters";

const Feed = () => {
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [brand, setBrand] = useState("all");
  const [category, setCategory] = useState("all");
  const [terrain, setTerrain] = useState("all");
  const [sort, setSort] = useState("recent");

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["feed-reviews", brand, category, terrain, sort],
    queryFn: async () => {
      let query = supabase
        .from("reviews")
        .select(`
          *,
          model:models(id, name, category, brand_id, brand:brands(name)),
          profile:profiles!reviews_user_id_fkey(username, avatar_url, display_name, user_id)
        `);

      if (terrain !== "all") query = query.eq("terrain", terrain as any);
      if (sort === "recent") query = query.order("created_at", { ascending: false });
      else if (sort === "rating") query = query.order("rating", { ascending: false });

      const { data, error } = await query.limit(50);

      if (error) {
        const { data: fallback } = await supabase
          .from("reviews")
          .select(`*, model:models(id, name, category, brand_id, brand:brands(name))`)
          .order("created_at", { ascending: false })
          .limit(50);
        return (fallback ?? []).map((r: any) => ({ ...r, profile: null }));
      }

      let filtered = data ?? [];
      if (brand !== "all") {
        filtered = filtered.filter((r: any) => r.model?.brand_id === brand);
      }
      if (category !== "all") {
        filtered = filtered.filter((r: any) => r.model?.category === category);
      }
      return filtered;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6 gap-4">
          <h1 className="text-3xl font-bold font-display shrink-0">Feed</h1>
          <div className="w-full max-w-xs">
            <UserSearch />
          </div>
        </div>

        <FeedFilters
          brand={brand} category={category} terrain={terrain} sort={sort}
          onBrandChange={setBrand} onCategoryChange={setCategory}
          onTerrainChange={setTerrain} onSortChange={setSort}
        />

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-xl border border-border h-64 animate-pulse" />
            ))}
          </div>
        ) : reviews && reviews.length > 0 ? (
          <div className="space-y-6">
            {reviews.map((review: any) => (
              <ReviewCard key={review.id} review={review} onClick={() => setSelectedReview(review)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg mb-2">No reviews yet</p>
            <p className="text-sm text-muted-foreground">Be the first to share your running shoe experience!</p>
          </div>
        )}

        <ReviewDetailModal review={selectedReview} open={!!selectedReview} onOpenChange={(open) => !open && setSelectedReview(null)} />
      </main>
    </div>
  );
};

export default Feed;
