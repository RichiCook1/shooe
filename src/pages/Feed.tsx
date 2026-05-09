import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/landing/Navbar";
import ReviewCard from "@/components/ReviewCard";
import ReviewDetailModal from "@/components/ReviewDetailModal";
import FeedFilters from "@/components/FeedFilters";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import UserSearch from "@/components/UserSearch";
import ShoeSearch from "@/components/ShoeSearch";

const Feed = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [brand, setBrand] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("recent");
  const [country, setCountry] = useState("all");
  const [city, setCity] = useState("");
  const [shareReview, setShareReview] = useState<any>(null);

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["feed-reviews", brand, category, sort, country, city],
    queryFn: async () => {
      let query = supabase.from("reviews").select(`*, model:models(id, name, category, image_url, brand_id, brand:brands(name))`);
      if (sort === "recent") query = query.order("created_at", { ascending: false });
      else if (sort === "rating") query = query.order("rating", { ascending: false });
      else if (sort === "popular") query = query.order("created_at", { ascending: false }); // will sort by likes client-side
      const { data, error } = await query.limit(20);
      if (error) return [];
      let filtered = data ?? [];
      if (brand !== "all") filtered = filtered.filter((r: any) => r.model?.brand_id === brand);
      if (category !== "all") filtered = filtered.filter((r: any) => r.model?.category === category);
      if (city) filtered = filtered.filter((r: any) => r.location?.toLowerCase().includes(city.toLowerCase()));
      if (country !== "all") filtered = filtered.filter((r: any) => r.location?.toLowerCase().includes(country.toLowerCase()));
      const userIds = [...new Set(filtered.map((r: any) => r.user_id).filter(Boolean))];
      let profileMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", userIds);
        profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p]));
      }
      return filtered.map((r: any) => ({ ...r, profile: r.user_id ? profileMap[r.user_id] || null : null }));
    },
  });

  // Auto-open review from URL param
  useEffect(() => {
    const reviewId = searchParams.get("reviewId");
    if (reviewId && reviews && reviews.length > 0) {
      const found = reviews.find((r: any) => r.id === reviewId);
      if (found) {
        setSelectedReview(found);
        setSearchParams({}, { replace: true });
      } else {
        supabase
          .from("reviews")
          .select(`*, model:models(id, name, category, image_url, brand_id, brand:brands(name))`)
          .eq("id", reviewId)
          .single()
          .then(async ({ data }) => {
            if (data) {
              let profile = null;
              if (data.user_id) {
                const { data: p } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").eq("user_id", data.user_id).single();
                profile = p;
              }
              setSelectedReview({ ...data, profile });
            }
            setSearchParams({}, { replace: true });
          });
      }
    }
  }, [searchParams, reviews]);

  const handleShare = (review: any) => {
    if (!user) {
      navigate("/login");
      return;
    }
    setShareReview(review);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="mb-4">
          <ShoeSearch />
        </div>
        <FeedFilters
          brand={brand} category={category} sort={sort} country={country} city={city}
          onBrandChange={setBrand} onCategoryChange={setCategory} onSortChange={setSort}
          onCountryChange={setCountry} onCityChange={setCity}
        />
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="bg-card rounded-xl border border-border h-64 animate-pulse" />)}
          </div>
        ) : reviews && reviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reviews.map((review: any) => (
              <ReviewCard key={review.id} review={review} onClick={() => setSelectedReview(review)} onShare={handleShare} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg mb-2">No reviews yet</p>
            <p className="text-sm text-muted-foreground">Be the first to share your shoe experience!</p>
          </div>
        )}
        <ReviewDetailModal review={selectedReview} open={!!selectedReview} onOpenChange={(open) => !open && setSelectedReview(null)} onShare={handleShare} />

        {/* Share review modal */}
        <Dialog open={!!shareReview} onOpenChange={(open) => !open && setShareReview(null)}>
          <DialogContent className="max-w-sm mx-4">
            <div className="space-y-4 pt-2">
              <div>
                <h3 className="text-lg font-bold font-display">Share review</h3>
                <p className="text-sm text-muted-foreground mt-1">Search for a user to send this review to:</p>
              </div>
              <UserSearch onSelect={(userId) => {
                if (shareReview && userId) {
                  navigate(`/messages?to=${userId}&reviewId=${shareReview.id}`);
                  setShareReview(null);
                }
              }} returnUserId />
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Feed;
