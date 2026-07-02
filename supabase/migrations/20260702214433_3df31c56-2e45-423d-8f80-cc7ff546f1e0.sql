
-- Crawler hit log
CREATE TABLE public.llm_crawler_hits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  bot_name TEXT NOT NULL,
  user_agent TEXT,
  path TEXT,
  referer TEXT,
  ip_hash TEXT,
  source TEXT NOT NULL DEFAULT 'beacon',
  metadata JSONB
);
CREATE INDEX idx_llm_crawler_hits_created ON public.llm_crawler_hits (created_at DESC);
CREATE INDEX idx_llm_crawler_hits_bot ON public.llm_crawler_hits (bot_name);
GRANT SELECT ON public.llm_crawler_hits TO authenticated;
GRANT ALL ON public.llm_crawler_hits TO service_role;
ALTER TABLE public.llm_crawler_hits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read crawler hits" ON public.llm_crawler_hits FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Citation probes
CREATE TABLE public.citation_probes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  category TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.citation_probes TO authenticated;
GRANT ALL ON public.citation_probes TO service_role;
ALTER TABLE public.citation_probes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage probes" ON public.citation_probes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER citation_probes_updated BEFORE UPDATE ON public.citation_probes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Probe runs
CREATE TABLE public.citation_probe_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  probe_id UUID NOT NULL REFERENCES public.citation_probes(id) ON DELETE CASCADE,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model TEXT NOT NULL,
  answer_text TEXT,
  cited_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  was_cited BOOLEAN NOT NULL DEFAULT false,
  position INTEGER,
  error TEXT
);
CREATE INDEX idx_probe_runs_probe ON public.citation_probe_runs (probe_id, run_at DESC);
CREATE INDEX idx_probe_runs_at ON public.citation_probe_runs (run_at DESC);
GRANT SELECT ON public.citation_probe_runs TO authenticated;
GRANT ALL ON public.citation_probe_runs TO service_role;
ALTER TABLE public.citation_probe_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read probe runs" ON public.citation_probe_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed probes
INSERT INTO public.citation_probes (question, category) VALUES
  ('Best marathon running shoes for wide feet 2026', 'segment'),
  ('Best trail running shoes for 50k ultramarathon', 'segment'),
  ('Best stability running shoes for overpronators', 'segment'),
  ('Best daily trainer running shoes under $150', 'segment'),
  ('Best carbon plate racing shoes 2026', 'segment'),
  ('Best running shoes for flat feet', 'segment'),
  ('Best zero drop running shoes', 'segment'),
  ('How is the Nike Pegasus 41', 'model'),
  ('How is the ON Cloudflow', 'model'),
  ('How is the Hoka Clifton 10', 'model'),
  ('How is the Brooks Ghost 16', 'model'),
  ('How is the Saucony Endorphin Speed 4', 'model'),
  ('Nike vs Hoka for daily training', 'brand'),
  ('Does Hoka make wide width running shoes', 'brand'),
  ('Best running shoe brands for beginners', 'brand');
