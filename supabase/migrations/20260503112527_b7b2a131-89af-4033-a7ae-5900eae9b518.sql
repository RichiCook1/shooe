-- Catalog system: image enrichment status + cron extensions
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS image_status text NOT NULL DEFAULT 'none';
-- 'none' | 'fetching' | 'ok' | 'failed'

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_models_image_status ON public.models(image_status);
CREATE INDEX IF NOT EXISTS idx_models_brand_id ON public.models(brand_id);
CREATE INDEX IF NOT EXISTS idx_models_name_trgm ON public.models USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_brands_name_trgm ON public.brands USING gin (name gin_trgm_ops);