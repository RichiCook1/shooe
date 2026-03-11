-- Allow users to delete their own review tags (needed for editing reviews)
CREATE POLICY "Users can delete tags on own reviews" ON public.review_tags
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM reviews WHERE reviews.id = review_tags.review_id AND reviews.user_id = auth.uid()
  )
);
