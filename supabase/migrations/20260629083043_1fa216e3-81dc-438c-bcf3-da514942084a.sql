
-- 1. Add segmentation columns to reviews (all nullable, additive)
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS gait text,
  ADD COLUMN IF NOT EXISTS foot_shape text,
  ADD COLUMN IF NOT EXISTS arch text,
  ADD COLUMN IF NOT EXISTS distance_focus text,
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS weight_band text,
  ADD COLUMN IF NOT EXISTS injury_history text,
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS race_seeded boolean NOT NULL DEFAULT false;

-- 2. Segments table
CREATE TABLE IF NOT EXISTS public.segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  category text,                 -- e.g. road, trail, racing
  description text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,  -- e.g. { "foot_shape":"wide", "distance_focus":"marathon" }
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.segments TO anon, authenticated;
GRANT ALL ON public.segments TO service_role;

ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "segments are publicly readable"
  ON public.segments FOR SELECT
  USING (true);

CREATE POLICY "admins can manage segments"
  ON public.segments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER segments_updated_at
  BEFORE UPDATE ON public.segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Aggregate stats view: (model x segment) -> count, avg rating
-- Filter operators applied at view-time using jsonb -> filters match across columns.
CREATE OR REPLACE VIEW public.model_segment_stats AS
SELECT
  s.slug              AS segment_slug,
  s.title             AS segment_title,
  r.model_id,
  COUNT(*)::int       AS review_count,
  ROUND(AVG(r.rating)::numeric, 2) AS avg_rating
FROM public.segments s
JOIN public.reviews r ON (
  (s.filters->>'gait' IS NULL OR r.gait = s.filters->>'gait') AND
  (s.filters->>'foot_shape' IS NULL OR r.foot_shape = s.filters->>'foot_shape') AND
  (s.filters->>'arch' IS NULL OR r.arch = s.filters->>'arch') AND
  (s.filters->>'terrain' IS NULL OR r.terrain::text = s.filters->>'terrain') AND
  (s.filters->>'distance_focus' IS NULL OR r.distance_focus = s.filters->>'distance_focus') AND
  (s.filters->>'goal' IS NULL OR r.goal = s.filters->>'goal') AND
  (s.filters->>'weight_band' IS NULL OR r.weight_band = s.filters->>'weight_band') AND
  (s.filters->>'injury_history' IS NULL OR r.injury_history = s.filters->>'injury_history')
)
WHERE r.rating IS NOT NULL
GROUP BY s.slug, s.title, r.model_id;

GRANT SELECT ON public.model_segment_stats TO anon, authenticated, service_role;

-- 4. Seed curated segment combos (idempotent)
INSERT INTO public.segments (slug, title, category, description, filters, sort_order) VALUES
  ('daily-trainer-neutral', 'Best Daily Trainers for Neutral Runners', 'road', 'Versatile cushioned shoes for everyday miles.', '{"gait":"neutral"}', 10),
  ('daily-trainer-overpronator', 'Best Stability Daily Trainers', 'road', 'Supportive daily trainers for overpronators.', '{"gait":"overpronation"}', 11),
  ('marathon-racing', 'Best Marathon Racing Shoes (2026)', 'racing', 'Carbon-plated super shoes for marathon PRs.', '{"distance_focus":"marathon","goal":"race"}', 20),
  ('half-marathon-racing', 'Best Half-Marathon Race Shoes', 'racing', 'Fast, responsive shoes for the half.', '{"distance_focus":"half_marathon","goal":"race"}', 21),
  ('5k-10k-racing', 'Best 5K/10K Racing Shoes', 'racing', 'Lightweight racers for short, fast efforts.', '{"distance_focus":"5k_10k","goal":"race"}', 22),
  ('trail-ultra', 'Best Trail Shoes for Ultras (50K+)', 'trail', 'Cushioned, protective trail shoes for long days.', '{"terrain":"trail","distance_focus":"ultra"}', 30),
  ('trail-technical', 'Best Technical Trail Shoes', 'trail', 'Grippy, agile shoes for technical terrain.', '{"terrain":"trail","goal":"technical"}', 31),
  ('trail-door-to-trail', 'Best Door-to-Trail Shoes', 'trail', 'Hybrid shoes that handle road and trail.', '{"terrain":"mixed"}', 32),
  ('wide-feet-road', 'Best Road Shoes for Wide Feet', 'road', 'Roomy toe boxes for wide-footed runners.', '{"foot_shape":"wide","terrain":"road"}', 40),
  ('wide-feet-trail', 'Best Trail Shoes for Wide Feet', 'trail', 'Wide-fit trail shoes with secure midfoot.', '{"foot_shape":"wide","terrain":"trail"}', 41),
  ('narrow-feet', 'Best Shoes for Narrow Feet', 'road', 'Snug-fitting shoes for narrow-footed runners.', '{"foot_shape":"narrow"}', 42),
  ('flat-feet-stability', 'Best Stability Shoes for Flat Feet', 'road', 'Arch support for low arches and flat feet.', '{"arch":"low","gait":"overpronation"}', 50),
  ('high-arch-cushion', 'Best Cushioned Shoes for High Arches', 'road', 'Plush cushion for high-arched neutral runners.', '{"arch":"high","gait":"neutral"}', 51),
  ('heavier-runners-daily', 'Best Daily Trainers for Heavier Runners (180+ lb)', 'road', 'Durable, supportive shoes for heavier athletes.', '{"weight_band":"180_plus"}', 60),
  ('lighter-runners-racing', 'Best Racing Shoes for Lighter Runners (Under 150 lb)', 'racing', 'Snappy, lightweight racers for smaller athletes.', '{"weight_band":"under_150","goal":"race"}', 61),
  ('beginners-first-shoe', 'Best Running Shoes for Beginners', 'road', 'Forgiving, easy-to-love first running shoes.', '{"goal":"beginner"}', 70),
  ('long-runs-cushion', 'Best Max-Cushion Shoes for Long Runs', 'road', 'Plush stacks for high-mileage long runs.', '{"distance_focus":"long_run"}', 71),
  ('tempo-workouts', 'Best Shoes for Tempo Workouts', 'road', 'Responsive trainers for fast-day efforts.', '{"goal":"tempo"}', 72),
  ('recovery-easy-days', 'Best Recovery Day Shoes', 'road', 'Soft, low-effort shoes for easy miles.', '{"goal":"recovery"}', 73),
  ('injury-recovery-plantar', 'Best Shoes After Plantar Fasciitis', 'road', 'Supportive shoes runners trust post-PF.', '{"injury_history":"plantar_fasciitis"}', 80),
  ('injury-recovery-knee', 'Best Shoes for Runners with Knee Pain', 'road', 'Cushioned, knee-friendly shoes.', '{"injury_history":"knee"}', 81),
  ('injury-recovery-achilles', 'Best Shoes for Achilles Issues', 'road', 'Higher-drop, achilles-friendly shoes.', '{"injury_history":"achilles"}', 82),
  ('marathon-wide-feet', 'Best Marathon Shoes for Wide Feet', 'racing', 'Race-day shoes with room for wide feet.', '{"distance_focus":"marathon","foot_shape":"wide"}', 90),
  ('trail-50k-wide-feet', 'Best 50K Trail Shoes for Wide Feet', 'trail', 'Long-distance trail shoes built wide.', '{"terrain":"trail","distance_focus":"ultra","foot_shape":"wide"}', 91),
  ('stability-flat-feet-marathon', 'Best Stability Marathon Shoes for Flat Feet', 'racing', 'Supportive marathon racers for flat-footed runners.', '{"gait":"overpronation","arch":"low","distance_focus":"marathon"}', 92),
  ('heavy-runner-marathon', 'Best Marathon Shoes for Heavier Runners', 'racing', 'Durable race-day shoes for 180+ lb runners.', '{"weight_band":"180_plus","distance_focus":"marathon"}', 93),
  ('beginner-overpronator', 'Best First Shoes for Overpronators', 'road', 'Supportive starter shoes for new runners who overpronate.', '{"goal":"beginner","gait":"overpronation"}', 94),
  ('mud-wet-trail', 'Best Shoes for Mud & Wet Trails', 'trail', 'Aggressive lugs for sloppy conditions.', '{"terrain":"trail","goal":"mud"}', 95),
  ('hot-weather-breathable', 'Most Breathable Running Shoes', 'road', 'Open, airy uppers for hot weather.', '{"goal":"breathable"}', 96),
  ('winter-road', 'Best Winter Road Running Shoes', 'road', 'Weather-resistant shoes for cold/wet roads.', '{"goal":"winter"}', 97)
ON CONFLICT (slug) DO NOTHING;
