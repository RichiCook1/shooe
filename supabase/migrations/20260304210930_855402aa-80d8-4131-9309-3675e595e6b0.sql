
DROP POLICY IF EXISTS "Authenticated users can insert models" ON public.models;
CREATE POLICY "Anyone can insert models" ON public.models FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can insert brands" ON public.brands;
CREATE POLICY "Anyone can insert brands" ON public.brands FOR INSERT WITH CHECK (true);
