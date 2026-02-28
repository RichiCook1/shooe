import { Heart, MessageCircle, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

interface ReviewCardProps {
  review: {
    id: string;
    rating: number | null;
    content: string | null;
    media_urls: string[] | null;
    location: string | null;
    terrain: string | null;
    distance_km: number | null;
    created_at: string;
    model?: { name: string; brand?: { name: string } } | null;
    profile?: { username: string | null; avatar_url: string | null; display_name: string | null; user_id: string } | null;
    likes_count?: number;
    comments_count?: number;
  };
}

const ReviewCard = ({ review }: ReviewCardProps) => {
  const brandModel = [review.model?.brand?.name, review.model?.name].filter(Boolean).join(" ");
  const displayName = review.profile?.display_name || review.profile?.username || "Anonymous";
  const avatar = review.profile?.avatar_url;
  const firstImage = review.media_urls?.[0];

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow">
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
          <button className="flex items-center gap-1 text-sm hover:text-primary transition-colors">
            <Heart className="w-4 h-4" />
            <span>{review.likes_count ?? 0}</span>
          </button>
          <button className="flex items-center gap-1 text-sm hover:text-primary transition-colors">
            <MessageCircle className="w-4 h-4" />
            <span>{review.comments_count ?? 0}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewCard;
