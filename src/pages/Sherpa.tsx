import { useState } from "react";
import { Send, Mountain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReviewCard from "@/components/ReviewCard";
import ReviewDetailModal from "@/components/ReviewDetailModal";
import Navbar from "@/components/landing/Navbar";
import ReactMarkdown from "react-markdown";

interface SherpaResult {
  answer: string;
  reviews: any[];
}

const SUGGESTIONS = [
  "Best trail running shoes?",
  "How is the ON Cloudflow?",
  "I need a shoe for road running under 100km",
  "Best shoes for wide feet?",
];

const Sherpa = () => {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SherpaResult | null>(null);
  const [selectedReview, setSelectedReview] = useState<any>(null);

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setResult(null);
    setQuestion("");

    try {
      const { data, error } = await supabase.functions.invoke("shoe-sherpa", {
        body: { question: trimmed },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        setLoading(false);
        return;
      }

      const reviewIds: string[] = data.reviewIds ?? [];
      let reviews: any[] = [];

      if (reviewIds.length > 0) {
        const { data: reviewData } = await supabase
          .from("reviews")
          .select("*, model:models(*, brand:brands(*)))")
          .in("id", reviewIds);

        if (reviewData && reviewData.length > 0) {
          const userIds = [...new Set(reviewData.filter((r: any) => r.user_id).map((r: any) => r.user_id))];
          let profileMap: Record<string, any> = {};
          if (userIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("user_id, username, display_name, avatar_url")
              .in("user_id", userIds);
            profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p]));
          }
          reviews = reviewData.map((r: any) => ({ ...r, profile: profileMap[r.user_id] || null }));
        }
      }

      setResult({ answer: data.answer, reviews });
    } catch (e: any) {
      console.error(e);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <div className="flex-1 container mx-auto px-4 py-8 max-w-4xl flex flex-col">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <Mountain className="w-8 h-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-display uppercase tracking-wider">Ask the Shoe Sherpa</h1>
          </div>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Ask anything about shoes — I'll search through real user reviews to find your answer.
          </p>
        </div>

        {/* Suggestions (show when no result) */}
        {!result && !loading && (
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => { setQuestion(s); ask(s); }}
                className="px-4 py-2 rounded-full border border-border text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Searching reviews…</span>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="flex-1 space-y-8">
            {/* AI Answer */}
            <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-card)] border border-border">
              <div className="flex items-start gap-3">
                <Mountain className="w-5 h-5 text-primary mt-1 shrink-0" />
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{result.answer}</ReactMarkdown>
                </div>
              </div>
            </div>

            {/* Reviews feed */}
            {result.reviews.length > 0 && (
              <div>
                <h2 className="font-display uppercase tracking-wider text-sm text-muted-foreground mb-4">
                  Matching Reviews ({result.reviews.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.reviews.map((review: any) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      onClick={() => setSelectedReview(review)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input bar */}
        <div className="sticky bottom-0 bg-background pt-4 pb-6 mt-auto">
          <form
            onSubmit={(e) => { e.preventDefault(); ask(question); }}
            className="flex gap-2"
          >
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask the Shoe Sherpa…"
              className="flex-1"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !question.trim()} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>

      {selectedReview && (
        <ReviewDetailModal
          review={selectedReview}
          open={!!selectedReview}
          onOpenChange={(open) => { if (!open) setSelectedReview(null); }}
        />
      )}
    </div>
  );
};

export default Sherpa;
