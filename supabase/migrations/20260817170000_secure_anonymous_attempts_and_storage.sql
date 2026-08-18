-- The upload policies from the preceding migration require this private bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'question-banks',
  'question-banks',
  false,
  52428800,
  ARRAY['application/pdf', 'text/plain']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Anonymous test operations are mediated by TanStack server functions using
-- the server-only service-role client. Direct anon table access allowed users
-- to enumerate every attempt and alter any unsubmitted attempt.
DROP POLICY IF EXISTS "anon insert attempt (v1 unsubmitted)" ON public.test_attempts;
DROP POLICY IF EXISTS "anyone read attempts (v1 by id)" ON public.test_attempts;
DROP POLICY IF EXISTS "anon update unsubmitted attempt" ON public.test_attempts;
DROP POLICY IF EXISTS "auth insert attempt" ON public.test_attempts;
DROP POLICY IF EXISTS "auth read attempts" ON public.test_attempts;
DROP POLICY IF EXISTS "auth update attempts" ON public.test_attempts;

REVOKE SELECT, INSERT, UPDATE ON public.test_attempts FROM anon;

CREATE POLICY "authenticated read own or admin attempts" ON public.test_attempts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

CREATE POLICY "authenticated insert own or admin attempts" ON public.test_attempts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (user_id = auth.uid() AND submitted_at IS NULL)
  );

CREATE POLICY "authenticated update own or admin attempts" ON public.test_attempts
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());
