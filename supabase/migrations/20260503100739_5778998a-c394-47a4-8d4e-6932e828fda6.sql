
-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Models flags
ALTER TABLE public.models
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS idx_models_name_trgm ON public.models USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_models_brand_id ON public.models(brand_id);

-- Model summaries cache
CREATE TABLE IF NOT EXISTS public.model_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL UNIQUE,
  summary text,
  avg_rating numeric,
  review_count integer NOT NULL DEFAULT 0,
  top_tags jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.model_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Summaries viewable by everyone" ON public.model_summaries FOR SELECT USING (true);
CREATE POLICY "Service can manage summaries" ON public.model_summaries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Admin review queue
CREATE TABLE IF NOT EXISTS public.model_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid,
  submitted_brand text NOT NULL,
  submitted_model text NOT NULL,
  web_check_result jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
ALTER TABLE public.model_review_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage review queue" ON public.model_review_queue FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Service can insert queue items" ON public.model_review_queue FOR INSERT TO service_role WITH CHECK (true);

-- Catalog job log
CREATE TABLE IF NOT EXISTS public.catalog_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  models_added integer NOT NULL DEFAULT 0,
  models_updated integer NOT NULL DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  notes text
);
ALTER TABLE public.catalog_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view catalog jobs" ON public.catalog_jobs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Service manage catalog jobs" ON public.catalog_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed curated brands (only if not present)
INSERT INTO public.brands (name, country, website) VALUES
  ('Nike','USA','https://www.nike.com'),
  ('Adidas','Germany','https://www.adidas.com'),
  ('Hoka','France','https://www.hoka.com'),
  ('Asics','Japan','https://www.asics.com'),
  ('Brooks','USA','https://www.brooksrunning.com'),
  ('Saucony','USA','https://www.saucony.com'),
  ('New Balance','USA','https://www.newbalance.com'),
  ('On','Switzerland','https://www.on.com'),
  ('Salomon','France','https://www.salomon.com'),
  ('La Sportiva','Italy','https://www.lasportiva.com'),
  ('Scarpa','Italy','https://www.scarpa.com'),
  ('Altra','USA','https://www.altrarunning.com'),
  ('Topo Athletic','USA','https://www.topoathletic.com'),
  ('Mizuno','Japan','https://www.mizuno.com'),
  ('Puma','Germany','https://www.puma.com'),
  ('Under Armour','USA','https://www.underarmour.com'),
  ('Merrell','USA','https://www.merrell.com'),
  ('Inov-8','UK','https://www.inov-8.com'),
  ('Nnormal','Spain','https://www.nnormal.com'),
  ('Norda','Canada','https://www.nordarun.com'),
  ('Speedland','USA','https://www.speedland.us'),
  ('Craft','Sweden','https://www.craftsports.com'),
  ('Diadora','Italy','https://www.diadora.com'),
  ('Reebok','USA','https://www.reebok.com'),
  ('Five Ten','USA','https://www.adidas.com/us/five_ten'),
  ('Black Diamond','USA','https://www.blackdiamondequipment.com'),
  ('Tecnica','Italy','https://www.tecnicasports.com'),
  ('Dynafit','Germany','https://www.dynafit.com'),
  ('Lowa','Germany','https://www.lowa.com'),
  ('Meindl','Germany','https://www.meindl.de'),
  ('Keen','USA','https://www.keenfootwear.com')
ON CONFLICT DO NOTHING;
