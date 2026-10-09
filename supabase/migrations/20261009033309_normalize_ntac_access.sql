-- Keep legacy report queries compatible with unlimited assigned NTAC access.
UPDATE public.profiles SET membership = 'NTAC ATHLETE', coach_care = true
WHERE ntac_enabled = true;
