
-- Tighten anon test_attempts policies
DROP POLICY "anyone can insert attempt" ON public.test_attempts;
DROP POLICY "anyone update own attempt" ON public.test_attempts;
DROP POLICY "auth insert attempt" ON public.test_attempts;

CREATE POLICY "anon insert attempt (v1 unsubmitted)" ON public.test_attempts
  FOR INSERT TO anon WITH CHECK (submitted_at IS NULL AND user_id IS NULL);

CREATE POLICY "auth insert attempt" ON public.test_attempts
  FOR INSERT TO authenticated WITH CHECK (submitted_at IS NULL);

CREATE POLICY "anon update unsubmitted attempt" ON public.test_attempts
  FOR UPDATE TO anon USING (submitted_at IS NULL) WITH CHECK (user_id IS NULL);

-- Lock down has_role: only authenticated code paths need it (anon policies never call it)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
