import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
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

export const startAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      test_series_id: z.string(),
      session_id: z.string().min(6).max(80),
      student_name: z.string().max(80).optional().nullable(),
      student_email: z.string().email().max(200).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = pubClient();
    const { data: row, error } = await sb
      .from("test_attempts")
      .insert({
        test_series_id: data.test_series_id,
        session_id: data.session_id,
        student_name: data.student_name ?? null,
        student_email: data.student_email ?? null,
      })
      .select("id, started_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

function isEqualAnswer(a: any, b: any): boolean {
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const s = [...a].map(String).sort();
    const t = [...b].map(String).sort();
    return s.every((v, i) => v === t[i]);
  }
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

export const submitAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      attempt_id: z.string(),
      answers: z.record(z.string(), z.any()),
      duration_seconds: z.number().min(0).max(60 * 60 * 24),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = pubClient();
    // Load attempt + test + questions
    const { data: attempt, error: aErr } = await sb.from("test_attempts").select("*, test:test_series(*)").eq("id", data.attempt_id).single();
    if (aErr || !attempt) throw new Error(aErr?.message || "Attempt not found");
    if (attempt.submitted_at) throw new Error("This attempt was already submitted.");

    const { data: qLinks } = await sb
      .from("test_series_questions")
      .select("marks_override, negative_override, question:questions(id, correct_answer, marks, negative_marks)")
      .eq("test_series_id", attempt.test_series_id);

    let obtained = 0;
    let total = 0;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    const test: any = (attempt as any).test;
    const negOn = !!test?.negative_marking;

    for (const link of qLinks ?? []) {
      const q: any = (link as any).question;
      if (!q) continue;
      const marks = Number(link.marks_override ?? q.marks ?? 1);
      const neg = Number(link.negative_override ?? q.negative_marks ?? 0);
      total += marks;
      const given = (data.answers as any)[q.id];
      if (given == null || (Array.isArray(given) && given.length === 0) || given === "") {
        skipped++;
        continue;
      }
      if (isEqualAnswer(given, q.correct_answer)) {
        obtained += marks;
        correct++;
      } else {
        wrong++;
        if (negOn) obtained -= neg;
      }
    }

    const attempted = correct + wrong;
    const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0;
    const percentage = total > 0 ? (obtained / total) * 100 : 0;
    const passed = obtained >= Number(test?.passing_marks ?? 0);

    const { error: upErr } = await sb
      .from("test_attempts")
      .update({
        submitted_at: new Date().toISOString(),
        duration_seconds: data.duration_seconds,
        answers: data.answers,
        total_marks: total,
        obtained_marks: obtained,
        correct_count: correct,
        wrong_count: wrong,
        skipped_count: skipped,
        percentage: Math.round(percentage * 100) / 100,
        accuracy: Math.round(accuracy * 100) / 100,
        passed,
      })
      .eq("id", data.attempt_id);
    if (upErr) throw new Error(upErr.message);

    return { ok: true, obtained, total, correct, wrong, skipped, percentage, accuracy, passed };
  });

export const getAttemptResult = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ attempt_id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const sb = pubClient();
    const { data: attempt, error } = await sb
      .from("test_attempts")
      .select("*, test:test_series(id, name, slug, passing_marks, duration_minutes)")
      .eq("id", data.attempt_id)
      .single();
    if (error || !attempt) throw new Error(error?.message || "Result not found");
    const { data: qs } = await sb
      .from("test_series_questions")
      .select("sort_order, question:questions(id, question_text, options, correct_answer, explanation, marks, negative_marks, difficulty, image_url)")
      .eq("test_series_id", attempt.test_series_id)
      .order("sort_order");
    return { attempt, questions: qs ?? [] };
  });