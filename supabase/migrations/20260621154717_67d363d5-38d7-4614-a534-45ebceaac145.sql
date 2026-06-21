
CREATE OR REPLACE FUNCTION public.merge_model_duplicates(p_pairs jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pair jsonb;
  keeper_id uuid;
  dupe_ids uuid[];
  donor_image text;
  merged int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  FOR pair IN SELECT * FROM jsonb_array_elements(p_pairs)
  LOOP
    keeper_id := (pair->>'keeper')::uuid;
    SELECT ARRAY(SELECT (jsonb_array_elements_text(pair->'dupes'))::uuid) INTO dupe_ids;

    IF array_length(dupe_ids, 1) IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.reviews SET model_id = keeper_id WHERE model_id = ANY(dupe_ids);

    IF (SELECT image_url FROM public.models WHERE id = keeper_id) IS NULL THEN
      SELECT image_url INTO donor_image
      FROM public.models
      WHERE id = ANY(dupe_ids) AND image_url IS NOT NULL
      LIMIT 1;
      IF donor_image IS NOT NULL THEN
        UPDATE public.models SET image_url = donor_image WHERE id = keeper_id;
      END IF;
    END IF;

    DELETE FROM public.models WHERE id = ANY(dupe_ids);
    merged := merged + 1;
  END LOOP;

  RETURN jsonb_build_object('merged', merged);
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_model_duplicates(jsonb) TO authenticated;
