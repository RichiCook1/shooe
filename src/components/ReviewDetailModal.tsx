import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, MapPin, MessageCircle, Send, ChevronLeft, ChevronRight, Bookmark, Share2, Edit2 } from "lucide-react";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { formatLocationCityCountry } from "@/lib/imageCompression";

interface ReviewDetailModalProps {
  review: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare?: (review: any) => void;
}

const ReviewDetailModal = ({ review, open, onOpenChange, onShare }: ReviewDetailModalProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [imageIdx, setImageIdx] = useState(0);
  const touchStart = useRef<number | null>(null);

  const brandModel = [review?.model?.brand?.name, review?.model?.name].filter(Boolean).join(" ");
  const displayName = review?.profile?.display_name || review?.profile?.username || "Anonymous";
  const images = review?.media_urls ?? [];
  const isOwner = user && review?.user_id === user.id;

  const { data: comments } = useQuery({
    queryKey: ["comments", review?.id],
    queryFn: async () => {
      const { data } = await supabase.from("comments").select("*").eq("review_id", review.id).order("created_at", { ascending: true });
      if (!data) return [];
      const userIds = [...new Set(data.map((c: any) => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", userIds);
      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p]));
      return data.map((c: any) => ({ ...c, profile: profileMap[c.user_id] || null }));
    },
    enabled: !!review?.id && open,
  });

  const { data: likes } = useQuery({
    queryKey: ["likes", review?.id],
    queryFn: async () => {
      const { data } = await supabase.from("likes").select("id, user_id").eq("review_id", review.id);
      return data ?? [];
    },
    enabled: !!review?.id && open,
  });

  const { data: likerProfiles } = useQuery({
    queryKey: ["liker-profiles", review?.id],
    queryFn: async () => {
      if (!likes || likes.length === 0) return [];
      const userIds = likes.map((l: any) => l.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", userIds);
      return profiles ?? [];
    },
    enabled: !!likes && likes.length > 0 && open,
  });

  const { data: isSaved } = useQuery({
    queryKey: ["saved", review?.id, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.from("saved_reviews").select("id").eq("user_id", user.id).eq("review_id", review.id).maybeSingle();
      return !!data;
    },
    enabled: !!review?.id && !!user && open,
  });

  const isLiked = likes?.some((l: any) => l.user_id === user?.id);

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!user) { toast.error("Log in to like reviews"); return; }
      if (isLiked) {
        const like = likes?.find((l: any) => l.user_id === user.id);
        if (like) await supabase.from("likes").delete().eq("id", like.id);
      } else {
        await supabase.from("likes").insert({ review_id: review.id, user_id: user.id });
        if (review.user_id && review.user_id !== user.id) {
          await supabase.from("notifications").insert({ user_id: review.user_id, actor_id: user.id, type: "like", review_id: review.id });
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["likes", review?.id] }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) { toast.error("Log in to save reviews"); return; }
      if (isSaved) {
        await supabase.from("saved_reviews").delete().eq("user_id", user.id).eq("review_id", review.id);
      } else {
        await supabase.from("saved_reviews").insert({ user_id: user.id, review_id: review.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved", review?.id, user?.id] });
      toast.success(isSaved ? "Removed from saved" : "Review saved!");
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!user) { toast.error("Log in to comment"); return; }
      if (!commentText.trim()) return;
      const { data: comment } = await supabase.from("comments").insert({ review_id: review.id, user_id: user.id, content: commentText.trim() }).select().single();
      if (comment && review.user_id && review.user_id !== user.id) {
        await supabase.from("notifications").insert({ user_id: review.user_id, actor_id: user.id, type: "comment", review_id: review.id, comment_id: comment.id });
      }
      setCommentText("");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", review?.id] });
      queryClient.invalidateQueries({ queryKey: ["comment-count", review?.id] });
    },
  });

  const { data: tags } = useQuery({
    queryKey: ["review-tags", review?.id],
    queryFn: async () => {
      const { data } = await supabase.from("review_tags").select("tag:tags(label, type)").eq("review_id", review.id);
      return data ?? [];
    },
    enabled: !!review?.id && open,
  });

  const handleTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && imageIdx < images.length - 1) setImageIdx(imageIdx + 1);
      if (diff < 0 && imageIdx > 0) setImageIdx(imageIdx - 1);
    }
    touchStart.current = null;
  };

  const locationDisplay = formatLocationCityCountry(review?.location);

  if (!review) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        {images.length > 0 && (
          <div className="relative bg-muted" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <img src={images[imageIdx]} alt="" className="w-full object-contain max-h-[400px]" loading="lazy" />
            {images.length > 1 && (
              <>
                {imageIdx > 0 && (
                  <button onClick={() => setImageIdx(imageIdx - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/70 flex items-center justify-center">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                {imageIdx < images.length - 1 && (
                  <button onClick={() => setImageIdx(imageIdx + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/70 flex items-center justify-center">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_: string, i: number) => (
                    <button key={i} onClick={() => setImageIdx(i)} className={`w-2 h-2 rounded-full transition-colors ${i === imageIdx ? "bg-primary-foreground" : "bg-primary-foreground/40"}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Link to={review.profile?.user_id ? `/profile/${review.profile.user_id}` : "#"} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {review.profile?.avatar_url ? (
                  <img src={review.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-muted-foreground">{displayName[0]?.toUpperCase()}</span>
                )}
              </div>
              <span className="text-sm font-medium">{displayName}</span>
            </Link>
            <div className="flex items-center gap-2">
              {isOwner && (
                <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => { onOpenChange(false); navigate(`/review?edit=${review.id}`); }}>
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </Button>
              )}
              <span className="text-xs text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-xl">{brandModel || "Unknown Shoe"}</h2>
            {review.rating != null && (
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold font-display text-primary">{review.rating}</span>
                <span className="text-sm text-muted-foreground">/10</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {review.terrain && <Badge variant="secondary" className="capitalize">{review.terrain}</Badge>}
            {review.distance_km && <Badge variant="secondary">{review.distance_km} km</Badge>}
            {locationDisplay && <Badge variant="secondary" className="gap-1"><MapPin className="w-3 h-3" />{locationDisplay}</Badge>}
          </div>

          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((rt: any, i: number) => (
                <Badge key={i} variant={rt.tag?.type === "positive" ? "default" : "destructive"} className="text-xs">{rt.tag?.label}</Badge>
              ))}
            </div>
          )}

          {review.content && <p className="text-sm text-foreground leading-relaxed">{review.content}</p>}

          <div className="flex items-center gap-4 pt-2 border-t border-border">
            <button onClick={() => likeMutation.mutate()} className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors">
              <Heart className={`w-5 h-5 ${isLiked ? "fill-primary text-primary" : ""}`} />
              <span>{likes?.length ?? 0}</span>
            </button>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MessageCircle className="w-5 h-5" />
              <span>{comments?.length ?? 0}</span>
            </span>
            <div className="ml-auto flex items-center gap-3">
              {onShare && (
                <button onClick={() => onShare(review)} className="text-sm hover:text-primary transition-colors">
                  <Share2 className="w-5 h-5" />
                </button>
              )}
              <button onClick={() => saveMutation.mutate()} className={`text-sm hover:text-primary transition-colors ${isSaved ? "text-primary" : ""}`}>
                <Bookmark className={`w-5 h-5 ${isSaved ? "fill-primary" : ""}`} />
              </button>
            </div>
          </div>

          {/* Who liked */}
          {likerProfiles && likerProfiles.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="flex -space-x-1.5">
                {likerProfiles.slice(0, 5).map((p: any) => (
                  <Link key={p.user_id} to={`/profile/${p.user_id}`} className="w-5 h-5 rounded-full bg-muted border border-background flex items-center justify-center overflow-hidden">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[8px] font-bold text-muted-foreground">{(p.display_name || p.username || "?")[0]?.toUpperCase()}</span>
                    )}
                  </Link>
                ))}
              </div>
              <span>
                Liked by{" "}
                <Link to={`/profile/${likerProfiles[0].user_id}`} className="font-medium text-foreground hover:underline">
                  {likerProfiles[0].display_name || likerProfiles[0].username || "someone"}
                </Link>
                {likerProfiles.length > 1 && (
                  <> and {likerProfiles.length - 1} other{likerProfiles.length > 2 ? "s" : ""}</>
                )}
              </span>
            </div>
          )}

          <div className="space-y-3 max-h-48 overflow-y-auto">
            {comments?.map((c: any) => (
              <div key={c.id} className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                  {c.profile?.avatar_url ? (
                    <img src={c.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold text-muted-foreground">{(c.profile?.display_name || c.profile?.username || "A")[0]?.toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-medium">{c.profile?.display_name || c.profile?.username || "Anonymous"}</span>
                  <p className="text-sm text-muted-foreground">{c.content}</p>
                </div>
              </div>
            ))}
          </div>

          {user && (
            <form onSubmit={(e) => { e.preventDefault(); commentMutation.mutate(); }} className="flex gap-2">
              <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment..." className="flex-1 h-9" />
              <Button type="submit" size="sm" variant="ghost" disabled={!commentText.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewDetailModal;
