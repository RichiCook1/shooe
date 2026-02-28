import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/landing/Navbar";
import ReviewCard from "@/components/ReviewCard";
import ReviewDetailModal from "@/components/ReviewDetailModal";
import { Bookmark } from "lucide-react";

const SavedReviews = () => {
  const { user } = useAuth();
  const [selectedReview, setSelectedReview] = useState<any>(null);

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["saved-reviews-page", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: saved } = await supabase
        .from("saved_reviews")
        .select("review_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!saved || saved.length === 0) return [];

      const reviewIds = saved.map((s: any) => s.review_id);
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select(`*, model:models(id, name, category, image_url, brand:brands(name))`)
        .in("id", reviewIds);
      if (!reviewsData) return [];

      const userIds = [...new Set(reviewsData.map((r: any) => r.user_id).filter(Boolean))];
      let profileMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url")
          .in("user_id", userIds);
        profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p]));
      }

      // Maintain saved order
      const reviewMap = Object.fromEntries(
        reviewsData.map((r: any) => [r.id, { ...r, profile: r.user_id ? profileMap[r.user_id] || null : null }])
      );
      return reviewIds.map((id: string) => reviewMap[id]).filter(Boolean);
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <h1 className="text-2xl font-display uppercase tracking-wider mb-6 flex items-center gap-2">
          <Bookmark className="w-5 h-5" />
          Saved Reviews
        </h1>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="bg-card rounded-xl border border-border h-64 animate-pulse" />)}
          </div>
        ) : reviews && reviews.length > 0 ? (
          <div className="space-y-6">
            {reviews.map((review: any) => (
              <ReviewCard key={review.id} review={review} onClick={() => setSelectedReview(review)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Bookmark className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No saved reviews yet</p>
            <p className="text-sm text-muted-foreground mt-1">Bookmark reviews from the feed to find them here</p>
          </div>
        )}
        <ReviewDetailModal review={selectedReview} open={!!selectedReview} onOpenChange={(open) => !open && setSelectedReview(null)} />
      </main>
    </div>
  );
};

export default SavedReviews;
