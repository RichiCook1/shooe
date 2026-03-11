-- Add new shoe categories to the enum
ALTER TYPE public.shoe_category ADD VALUE IF NOT EXISTS 'indoor_climbing';
ALTER TYPE public.shoe_category ADD VALUE IF NOT EXISTS 'outdoor_climbing';
ALTER TYPE public.shoe_category ADD VALUE IF NOT EXISTS 'mountaineering';
ALTER TYPE public.shoe_category ADD VALUE IF NOT EXISTS 'hiking';
ALTER TYPE public.shoe_category ADD VALUE IF NOT EXISTS 'recovery';
