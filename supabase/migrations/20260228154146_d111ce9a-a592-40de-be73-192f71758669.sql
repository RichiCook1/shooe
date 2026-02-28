
-- The permissive INSERT policies on reviews and review_tags are intentional:
-- Guest users (unauthenticated) need to submit reviews.
-- We add a comment to document this is by design, and tighten review_tags
-- to only allow inserting tags for reviews that exist.

-- Drop and recreate review_tags insert policy with a subquery check
DROP POLICY "Anyone can create review tags" ON public.review_tags;
CREATE POLICY "Anyone can create review tags for existing reviews" ON public.review_tags
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.reviews WHERE id = review_id)
  );

-- The reviews INSERT policy stays permissive by design (guest reviews).
-- Add a comment via a no-op policy rename approach: drop and recreate with clearer name
DROP POLICY "Users can create reviews" ON public.reviews;
CREATE POLICY "Anyone can create reviews (guests allowed)" ON public.reviews
  FOR INSERT WITH CHECK (true);
