
-- Function to claim guest reviews after signup
CREATE OR REPLACE FUNCTION public.claim_guest_reviews(p_user_id uuid, p_session_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.reviews
  SET user_id = p_user_id, is_guest = false
  WHERE guest_session_id = p_session_id AND is_guest = true;
END;
$$;
