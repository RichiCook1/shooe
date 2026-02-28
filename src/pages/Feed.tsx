import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/landing/Navbar";
import ReviewCard from "@/components/ReviewCard";

const Feed = () => {
  const { data: reviews, isLoading } = useQuery({
    queryKey: ["feed-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(`
          *,
          model:models(name, brand:brands(name)),
          profile:profiles!reviews_user_id_fkey(username, avatar_url, display_name, user_id)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        // Fallback without the foreign key hint if it fails
        const { data: fallback } = await supabase
          .from("reviews")
          .select(`*, model:models(name, brand:brands(name))`)
          .order("created_at", { ascending: false })
          .limit(50);
        return (fallback ?? []).map((r: any) => ({ ...r, profile: null }));
      }
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold font-display mb-6">Feed</h1>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-xl border border-border h-64 animate-pulse" />
            ))}
          </div>
        ) : reviews && reviews.length > 0 ? (
          <div className="space-y-6">
            {reviews.map((review: any) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg mb-2">No reviews yet</p>
            <p className="text-sm text-muted-foreground">Be the first to share your running shoe experience!</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Feed;
