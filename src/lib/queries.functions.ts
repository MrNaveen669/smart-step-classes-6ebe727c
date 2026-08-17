import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function pubClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const listPublishedSubjects = createServerFn({ method: "GET" }).handler(async () => {
  const sb = pubClient();
  const { data, error } = await sb
    .from("subjects")
    .select("id, name, slug, description, icon, color, sort_order")
    .eq("status", "published")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listPublishedTests = createServerFn({ method: "GET" }).handler(async () => {
  const sb = pubClient();
  const { data, error } = await sb
    .from("test_series")
    .select("id, name, slug, description, duration_minutes, total_marks, is_featured, is_free, subject_id, attempt_count, created_at, expiry_date")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).filter((t) => !t.expiry_date || new Date(t.expiry_date) > new Date());
});

export const getPublishedTestBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const sb = pubClient();
    const { data: test, error } = await sb
      .from("test_series")
      .select("*, subject:subjects(name, slug), chapter:chapters(name)")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!test) return null;
    const { data: qs, error: questionsError } = await sb
      .from("test_series_questions")
      .select("sort_order, marks_override, negative_override, question:questions(id, question_text, question_type, options, difficulty, marks, negative_marks, image_url)")
      .eq("test_series_id", test.id)
      .order("sort_order");
    if (questionsError) throw new Error(questionsError.message);
    return { test, questions: qs ?? [] };
  });
