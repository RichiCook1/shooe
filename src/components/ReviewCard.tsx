import { Heart, MessageCircle, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ReviewCardProps {
  review: any;
  onClick?: () => void;
}

const ReviewCard = ({ review, onClick }: ReviewCardProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const brandModel = [review.model?.brand?.name, review.model?.name].filter(Boolean).join(" ");
  const displayName = review.profile?.display_name || review.profile?.username || "Anonymous";
  const avatar = review.profile?.avatar_url;
  const firstImage = review.media_urls?.[0];

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

  const isLiked = likes?.some((l: any) => l.user_id === user?.id);

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!user) { toast.error("Log in to like reviews"); return; }
      if (isLiked) {
        const like = likes?.find((l: any) => l.user_id === user.id);
        if (like) await supabase.from("likes").delete().eq("id", like.id);
      } else {
        await supabase.from("likes").insert({ review_id: review.id, user_id: user.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["likes", review.id] });
    },
  });

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow cursor-pointer" onClick={onClick}>
      {firstImage && (
        <div className="aspect-[4/3] overflow-hidden">
          <img src={firstImage} alt={brandModel} className="w-full h-full object-cover" />
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
                <span className="text-xs font-bold text-muted-foreground">
                  {displayName[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <span className="text-sm font-medium truncate">{displayName}</span>
          </Link>
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {new Date(review.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Shoe + rating */}
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg">{brandModel || "Unknown Shoe"}</h3>
          {review.rating != null && (
            <span className="text-xl font-bold font-display text-primary">{review.rating}</span>
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
        </div>
      </div>
    </div>
  );
};

export default ReviewCard;
