ALTER TABLE public.test_series
  ADD COLUMN IF NOT EXISTS show_answers_after_submit BOOLEAN NOT NULL DEFAULT false;
