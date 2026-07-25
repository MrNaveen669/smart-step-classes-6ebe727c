
CREATE POLICY "admins read question-banks" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'question-banks' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins upload question-banks" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'question-banks' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update question-banks" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'question-banks' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete question-banks" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'question-banks' AND public.has_role(auth.uid(), 'admin'));
