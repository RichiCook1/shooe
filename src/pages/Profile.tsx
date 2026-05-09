import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/landing/Navbar";
import ReviewCard from "@/components/ReviewCard";
import ReviewDetailModal from "@/components/ReviewDetailModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useNavigate } from "react-router-dom";
import { Settings, UserPlus, UserMinus, MessageCircle, X, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getStorageThumb } from "@/lib/imageCompression";

const Profile = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profileUserId = userId || user?.id;
  const isOwnProfile = profileUserId === user?.id;
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [followListType, setFollowListType] = useState<"followers" | "following" | null>(null);
  const [shoeModelFeed, setShoeModelFeed] = useState<{ modelId: string; modelName: string; brandName: string } | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", profileUserId],
    queryFn: async () => {
      if (!profileUserId) return null;
      const { data } = await supabase.from("profiles").select("*").eq("user_id", profileUserId).maybeSingle();
      return data;
    },
    enabled: !!profileUserId,
  });

  const { data: reviews } = useQuery({
    queryKey: ["user-reviews", profileUserId],
    queryFn: async () => {
      if (!profileUserId) return [];
      const { data } = await supabase.from("reviews").select(`*, model:models(id, name, category, image_url, brand:brands(name))`).eq("user_id", profileUserId).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profileUserId,
  });

  // Group reviews by shoe model for Shoes tab
  const shoeGroups = reviews ? Object.values(
    reviews.reduce((acc: Record<string, any>, review: any) => {
      const modelId = review.model?.id;
      if (!modelId) return acc;
      if (!acc[modelId]) {
        acc[modelId] = {
          modelId,
          modelName: review.model?.name || "Unknown",
          brandName: review.model?.brand?.name || "",
          coverImage: review.media_urls?.[0] || null,
          reviewCount: 0,
          latestDate: review.created_at,
        };
      }
      acc[modelId].reviewCount++;
      if (review.created_at > acc[modelId].latestDate) {
        acc[modelId].latestDate = review.created_at;
        if (review.media_urls?.[0]) {
          acc[modelId].coverImage = review.media_urls[0];
        }
      }
      return acc;
    }, {})
  ) : [];

  // Reviews for a specific shoe model
  const shoeModelReviews = shoeModelFeed
    ? reviews?.filter((r: any) => r.model?.id === shoeModelFeed.modelId) ?? []
    : [];

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
      const { data } = await supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", profileUserId).maybeSingle();
      return !!data;
    },
    enabled: !!user && !!profileUserId && !isOwnProfile,
  });

  const { data: followList } = useQuery({
    queryKey: ["follow-list", profileUserId, followListType],
    queryFn: async () => {
      if (!profileUserId || !followListType) return [];
      const col = followListType === "followers" ? "follower_id" : "following_id";
      const filterCol = followListType === "followers" ? "following_id" : "follower_id";
      const { data } = await supabase.from("follows").select(col).eq(filterCol, profileUserId);
      if (!data || data.length === 0) return [];
      const userIds = data.map((f: any) => f[col]);
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", userIds);
      return profiles ?? [];
    },
    enabled: !!profileUserId && !!followListType,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!user || !profileUserId) return;
      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profileUserId);
      } else {
        await supabase.from("follows").insert({ follower_id: user.id, following_id: profileUserId });
        await supabase.from("notifications").insert({ user_id: profileUserId, actor_id: user.id, type: "follow" });
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
              <img src={getStorageThumb(profile.avatar_url, { width: 160, quality: 75 }) || profile.avatar_url} alt="" className="w-full h-full object-cover" decoding="async" />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">{displayName[0]?.toUpperCase()}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold font-display truncate">{displayName}</h1>
              {isOwnProfile ? (
                <Link to="/edit-profile">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Settings className="w-4 h-4" /> Edit
                  </Button>
                </Link>
              ) : user ? (
                <div className="flex gap-2">
                  <Button
                    variant={isFollowing ? "outline" : "default"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => followMutation.mutate()}
                    disabled={followMutation.isPending}
                  >
                    {isFollowing ? <><UserMinus className="w-4 h-4" /> Unfollow</> : <><UserPlus className="w-4 h-4" /> Follow</>}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => navigate(`/messages?to=${profileUserId}`)}
                  >
                    <MessageCircle className="w-4 h-4" /> Message
                  </Button>
                </div>
              ) : null}
            </div>
            {profile?.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
            {profile?.bio && <p className="text-sm mt-2">{profile.bio}</p>}

            {/* Stats */}
            <div className="flex gap-6 mt-4 text-sm">
              <div><span className="font-bold">{reviews?.length ?? 0}</span> <span className="text-muted-foreground">reviews</span></div>
              <button onClick={() => setFollowListType("followers")} className="hover:underline">
                <span className="font-bold">{followCounts?.followers ?? 0}</span> <span className="text-muted-foreground">followers</span>
              </button>
              <button onClick={() => setFollowListType("following")} className="hover:underline">
                <span className="font-bold">{followCounts?.following ?? 0}</span> <span className="text-muted-foreground">following</span>
              </button>
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

        {/* Tabs */}
        <Tabs defaultValue="reviews" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="shoes">Shoes</TabsTrigger>
          </TabsList>

          <TabsContent value="reviews">
            {reviews && reviews.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reviews.map((review: any) => (
                  <ReviewCard
                    key={review.id}
                    review={{ ...review, profile: profile ? { ...profile } : null }}
                    onClick={() => setSelectedReview({ ...review, profile: profile ? { ...profile } : null })}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                {isOwnProfile ? "You haven't reviewed any shoes yet." : "No reviews yet."}
              </div>
            )}
          </TabsContent>

          <TabsContent value="shoes">
            {shoeGroups.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {(shoeGroups as any[]).map((shoe) => (
                  <button
                    key={shoe.modelId}
                    onClick={() => setShoeModelFeed({ modelId: shoe.modelId, modelName: shoe.modelName, brandName: shoe.brandName })}
                    className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-[var(--shadow-elevated)] transition-shadow text-left"
                  >
                    <div className="aspect-square bg-muted overflow-hidden">
                      {shoe.coverImage ? (
                        <img src={getStorageThumb(shoe.coverImage, { width: 400, quality: 65 }) || shoe.coverImage} alt={shoe.modelName} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No photo</div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-display font-bold text-sm truncate">{shoe.brandName} {shoe.modelName}</p>
                      <p className="text-xs text-muted-foreground">{shoe.reviewCount} review{shoe.reviewCount !== 1 ? "s" : ""}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">No shoes reviewed yet.</div>
            )}
          </TabsContent>
        </Tabs>

        <ReviewDetailModal
          review={selectedReview}
          open={!!selectedReview}
          onOpenChange={(open) => !open && setSelectedReview(null)}
        />

        {/* Shoe model feed modal */}
        <Dialog open={!!shoeModelFeed} onOpenChange={(open) => !open && setShoeModelFeed(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <h3 className="text-xl font-bold font-display mb-4">
              {shoeModelFeed?.brandName} {shoeModelFeed?.modelName}
            </h3>
            <div className="space-y-4">
              {shoeModelReviews.map((review: any) => (
                <ReviewCard
                  key={review.id}
                  review={{ ...review, profile: profile ? { ...profile } : null }}
                  onClick={() => { setShoeModelFeed(null); setSelectedReview({ ...review, profile: profile ? { ...profile } : null }); }}
                />
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Follow list modal */}
        <Dialog open={!!followListType} onOpenChange={(open) => !open && setFollowListType(null)}>
          <DialogContent className="max-w-sm">
            <h3 className="text-lg font-bold font-display capitalize mb-4">{followListType}</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {followList && followList.length > 0 ? followList.map((p: any) => (
                <Link
                  key={p.user_id}
                  to={`/profile/${p.user_id}`}
                  onClick={() => setFollowListType(null)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">{(p.display_name || p.username || "?")[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.display_name || p.username || "Runner"}</p>
                    {p.username && <p className="text-xs text-muted-foreground">@{p.username}</p>}
                  </div>
                </Link>
              )) : (
                <p className="text-sm text-muted-foreground text-center py-4">No {followListType} yet</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Profile;
