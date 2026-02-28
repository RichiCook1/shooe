import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/landing/Navbar";
import ReviewCard from "@/components/ReviewCard";
import ReviewDetailModal from "@/components/ReviewDetailModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Settings, UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const Profile = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const profileUserId = userId || user?.id;
  const isOwnProfile = profileUserId === user?.id;
  const [selectedReview, setSelectedReview] = useState<any>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", profileUserId],
    queryFn: async () => {
      if (!profileUserId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", profileUserId)
        .maybeSingle();
      return data;
    },
    enabled: !!profileUserId,
  });

  const { data: reviews } = useQuery({
    queryKey: ["user-reviews", profileUserId],
    queryFn: async () => {
      if (!profileUserId) return [];
      const { data } = await supabase
        .from("reviews")
        .select(`*, model:models(name, brand:brands(name))`)
        .eq("user_id", profileUserId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profileUserId,
  });

  const { data: followCounts } = useQuery({
    queryKey: ["follow-counts", profileUserId],
    queryFn: async () => {
      if (!profileUserId) return { followers: 0, following: 0 };
      const [{ count: followers }, { count: following }] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profileUserId),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profileUserId),
      ]);
      return { followers: followers ?? 0, following: following ?? 0 };
    },
    enabled: !!profileUserId,
  });

  const { data: isFollowing } = useQuery({
    queryKey: ["is-following", user?.id, profileUserId],
    queryFn: async () => {
      if (!user || !profileUserId || isOwnProfile) return false;
      const { data } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", profileUserId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!profileUserId && !isOwnProfile,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!user || !profileUserId) return;
      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profileUserId);
      } else {
        await supabase.from("follows").insert({ follower_id: user.id, following_id: profileUserId });
        // Notification
        await supabase.from("notifications").insert({
          user_id: profileUserId,
          actor_id: user.id,
          type: "follow",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-following", user?.id, profileUserId] });
      queryClient.invalidateQueries({ queryKey: ["follow-counts", profileUserId] });
    },
    onError: () => toast.error("Could not update follow status"),
  });

  const displayName = profile?.display_name || profile?.username || "Runner";

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Profile Header */}
        <div className="flex items-start gap-6 mb-8">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">
                {displayName[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold font-display truncate">{displayName}</h1>
              {isOwnProfile ? (
                <Link to="/edit-profile">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Settings className="w-4 h-4" />
                    Edit
                  </Button>
                </Link>
              ) : user ? (
                <Button
                  variant={isFollowing ? "outline" : "default"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => followMutation.mutate()}
                  disabled={followMutation.isPending}
                >
                  {isFollowing ? <><UserMinus className="w-4 h-4" /> Unfollow</> : <><UserPlus className="w-4 h-4" /> Follow</>}
                </Button>
              ) : null}
            </div>
            {profile?.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
            {profile?.bio && <p className="text-sm mt-2">{profile.bio}</p>}

            {/* Stats */}
            <div className="flex gap-6 mt-4 text-sm">
              <div><span className="font-bold">{reviews?.length ?? 0}</span> <span className="text-muted-foreground">reviews</span></div>
              <div><span className="font-bold">{followCounts?.followers ?? 0}</span> <span className="text-muted-foreground">followers</span></div>
              <div><span className="font-bold">{followCounts?.following ?? 0}</span> <span className="text-muted-foreground">following</span></div>
            </div>

            {/* Running info */}
            <div className="flex flex-wrap gap-2 mt-3">
              {profile?.terrains?.map((t: string) => (
                <Badge key={t} variant="secondary" className="capitalize">{t}</Badge>
              ))}
              {profile?.weekly_volume && (
                <Badge variant="secondary">
                  {profile.weekly_volume === "lt_10km" ? "<10km/wk" : profile.weekly_volume === "10_30km" ? "10-30km/wk" : ">30km/wk"}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Reviews */}
        <h2 className="text-lg font-bold font-display mb-4">Reviews</h2>
        {reviews && reviews.length > 0 ? (
          <div className="space-y-6">
            {reviews.map((review: any) => (
              <ReviewCard key={review.id} review={{ ...review, profile: profile ? { ...profile } : null }} onClick={() => setSelectedReview({ ...review, profile: profile ? { ...profile } : null })} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            {isOwnProfile ? "You haven't reviewed any shoes yet." : "No reviews yet."}
          </div>
        )}

        <ReviewDetailModal review={selectedReview} open={!!selectedReview} onOpenChange={(open) => !open && setSelectedReview(null)} />
      </main>
    </div>
  );
};

export default Profile;
