import { useState, useRef } from "react";
import { Heart, MessageCircle, MapPin, ChevronLeft, ChevronRight, Bookmark, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ReviewCardProps {
  review: any;
  onClick?: () => void;
  onShare?: (review: any) => void;
}

const ReviewCard = ({ review, onClick, onShare }: ReviewCardProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const brandModel = [review.model?.brand?.name, review.model?.name].filter(Boolean).join(" ");
  const displayName = review.profile?.display_name || review.profile?.username || "Anonymous";
  const avatar = review.profile?.avatar_url;
  const images = review.media_urls ?? [];
  const [imgIdx, setImgIdx] = useState(0);
  const touchStart = useRef<number | null>(null);

  const { data: likes } = useQuery({
    queryKey: ["likes", review.id],
    queryFn: async () => {
      const { data } = await supabase.from("likes").select("id, user_id").eq("review_id", review.id);
      return data ?? [];
    },
  });

  const { data: commentCount } = useQuery({
    queryKey: ["comment-count", review.id],
    queryFn: async () => {
      const { count } = await supabase.from("comments").select("id", { count: "exact", head: true }).eq("review_id", review.id);
      return count ?? 0;
    },
  });

  const { data: isSaved } = useQuery({
    queryKey: ["saved", review.id, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.from("saved_reviews").select("id").eq("user_id", user.id).eq("review_id", review.id).maybeSingle();
      return !!data;
    },
    enabled: !!user,
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
          await supabase.from("notifications").insert({
            user_id: review.user_id,
            actor_id: user.id,
            type: "like",
            review_id: review.id,
          });
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["likes", review.id] }),
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
      queryClient.invalidateQueries({ queryKey: ["saved", review.id, user?.id] });
      toast.success(isSaved ? "Removed from saved" : "Review saved!");
    },
  });

  const handleTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && imgIdx < images.length - 1) setImgIdx(imgIdx + 1);
      if (diff < 0 && imgIdx > 0) setImgIdx(imgIdx - 1);
    }
    touchStart.current = null;
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow cursor-pointer" onClick={onClick}>
      {images.length > 0 && (
        <div className="relative aspect-[4/3] overflow-hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <img src={images[imgIdx]} alt={brandModel} className="w-full h-full object-cover" />
          {images.length > 1 && (
            <>
              {imgIdx > 0 && (
                <button className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-background/70 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setImgIdx(imgIdx - 1); }}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              {imgIdx < images.length - 1 && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-background/70 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setImgIdx(imgIdx + 1); }}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {images.map((_: string, i: number) => (
                  <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === imgIdx ? "bg-primary-foreground" : "bg-primary-foreground/40"}`} />
                ))}
              </div>
            </>
          )}
          {/* Rating overlay on image */}
          {review.rating != null && (
            <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm rounded-lg px-2.5 py-1 shadow-sm">
              <span className="text-lg font-bold font-display text-primary">{review.rating}</span>
              <span className="text-xs text-muted-foreground">/10</span>
            </div>
          )}
        </div>
      )}
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            to={review.profile?.user_id ? `/profile/${review.profile.user_id}` : "#"}
            className="flex items-center gap-2 min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
              {avatar ? (
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-muted-foreground">{displayName[0]?.toUpperCase()}</span>
              )}
            </div>
            <span className="text-sm font-medium truncate">{displayName}</span>
          </Link>
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {new Date(review.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Shoe + rating (for no-image reviews) */}
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg">{brandModel || "Unknown Shoe"}</h3>
          {review.rating != null && images.length === 0 && (
            <div className="flex items-baseline gap-0.5">
              <span className="text-xl font-bold font-display text-primary">{review.rating}</span>
              <span className="text-xs text-muted-foreground">/10</span>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-2">
          {review.terrain && <Badge variant="secondary" className="capitalize">{review.terrain}</Badge>}
          {review.distance_km && <Badge variant="secondary">{review.distance_km} km</Badge>}
          {review.location && (
            <Badge variant="secondary" className="gap-1">
              <MapPin className="w-3 h-3" />
              {review.location}
            </Badge>
          )}
        </div>

        {/* Content */}
        {review.content && (
          <p className="text-sm text-muted-foreground line-clamp-3">{review.content}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 pt-1 text-muted-foreground">
          <button
            className={`flex items-center gap-1 text-sm hover:text-primary transition-colors ${isLiked ? "text-primary" : ""}`}
            onClick={(e) => { e.stopPropagation(); likeMutation.mutate(); }}
          >
            <Heart className={`w-4 h-4 ${isLiked ? "fill-primary" : ""}`} />
            <span>{likes?.length ?? 0}</span>
          </button>
          <button className="flex items-center gap-1 text-sm hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
            <MessageCircle className="w-4 h-4" />
            <span>{commentCount ?? 0}</span>
          </button>
          <div className="ml-auto flex items-center gap-2">
            {onShare && (
              <button className="text-sm hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); onShare(review); }}>
                <Share2 className="w-4 h-4" />
              </button>
            )}
            <button
              className={`text-sm hover:text-primary transition-colors ${isSaved ? "text-primary" : ""}`}
              onClick={(e) => { e.stopPropagation(); saveMutation.mutate(); }}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? "fill-primary" : ""}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewCard;
