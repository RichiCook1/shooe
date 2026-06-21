CREATE TABLE public.catalog_job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.catalog_jobs(id) ON DELETE CASCADE,
  model_id uuid,
  model_name text,
  stage text NOT NULL,
  status text NOT NULL DEFAULT 'info',
  message text,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_catalog_job_events_job_id ON public.catalog_job_events(job_id, created_at);
GRANT SELECT ON public.catalog_job_events TO authenticated;
GRANT ALL ON public.catalog_job_events TO service_role;
ALTER TABLE public.catalog_job_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view job events" ON public.catalog_job_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));