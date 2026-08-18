import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function logStartAttemptFailure(stage: string, error: unknown) {
  const maybeError = error as { code?: unknown; message?: unknown; name?: unknown; status?: unknown } | null;
  const details = {
    code: maybeError?.code ?? null,
    message: maybeError?.message ?? (error instanceof Error ? error.message : String(error)),
    name: maybeError?.name ?? (error instanceof Error ? error.name : null),
    status: maybeError?.status ?? null,
  };
  console.error("[start-attempt] failed", { stage, ...details });
}

export const startAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      test_series_id: z.string(),
      session_id: z.string().min(6).max(80),
      student_name: z.string().trim().min(2, "Please enter your name.").max(80).refine((value) => (value.match(/[\p{L}\p{N}]/gu)?.length ?? 0) >= 2, "Please enter your name."),
      student_email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(200),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
      const { data: test, error: testError } = await sb
        .from("test_series")
        .select("id, status, expiry_date")
        .eq("id", data.test_series_id)
        .maybeSingle();
      if (testError) {
        logStartAttemptFailure("load-test", testError);
        throw new Error("This test is not available.");
      }
      if (!test || test.status !== "published") throw new Error("This test is not available.");
      if (test.expiry_date && new Date(test.expiry_date).getTime() <= Date.now()) {
        throw new Error("This test has expired.");
      }

      const { count, error: questionsError } = await sb
        .from("test_series_questions")
        .select("id", { count: "exact", head: true })
        .eq("test_series_id", test.id);
      if (questionsError) {
        logStartAttemptFailure("count-questions", questionsError);
        throw new Error("Could not verify this test's questions. Please try again.");
      }
      if ((count ?? 0) === 0) throw new Error("This test has no questions yet.");

      const attemptId = crypto.randomUUID();
      const { data: attempt, error: insertError } = await sb
        .from("test_attempts")
        .insert({
          id: attemptId,
          test_series_id: data.test_series_id,
          session_id: data.session_id,
          student_name: data.student_name,
          student_email: data.student_email,
        })
        .select("id, started_at")
        .single();
      if (insertError || !attempt) {
        logStartAttemptFailure("insert-attempt", insertError ?? new Error("No attempt returned"));
        throw new Error("Could not create your test attempt. Please try again.");
      }

      return { id: attempt.id, started_at: attempt.started_at };
    } catch (error) {
      logStartAttemptFailure("handler", error);
      throw error;
    }
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
      session_id: z.string().min(6).max(80),
      answers: z.record(z.string(), z.any()),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    // Load attempt + test + questions
    const { data: attempt, error: aErr } = await sb
      .from("test_attempts")
      .select("*, test:test_series(*)")
      .eq("id", data.attempt_id)
      .eq("session_id", data.session_id)
      .single();
    if (aErr || !attempt) throw new Error(aErr?.message || "Attempt not found");
    if (attempt.submitted_at) throw new Error("This attempt was already submitted.");

    const { data: qLinks, error: questionsError } = await sb
      .from("test_series_questions")
      .select("marks_override, negative_override, question:questions(id, correct_answer, marks, negative_marks)")
      .eq("test_series_id", attempt.test_series_id);
    if (questionsError) throw new Error(questionsError.message);

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
    const startedAt = new Date(attempt.started_at).getTime();
    const elapsedSeconds = Number.isFinite(startedAt)
      ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
      : 0;
    const durationSeconds = Math.min(
      elapsedSeconds,
      Math.max(0, Number(test?.duration_minutes ?? 0) * 60),
    );

    const { data: updated, error: upErr } = await sb
      .from("test_attempts")
      .update({
        submitted_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
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
      .eq("id", data.attempt_id)
      .eq("session_id", data.session_id)
      .is("submitted_at", null)
      .select("id")
      .maybeSingle();
    if (upErr) throw new Error(upErr.message);
    if (!updated) throw new Error("This attempt was already submitted.");

    return { ok: true };
  });

export const getAttemptResult = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ attempt_id: z.string(), session_id: z.string().min(6).max(80) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: attempt, error } = await sb
      .from("test_attempts")
      .select("id, test_series_id, started_at, submitted_at, duration_seconds, total_marks, obtained_marks, correct_count, wrong_count, skipped_count, percentage, passed, answers, test:test_series(id, name, slug, passing_marks, show_answers_after_submit)")
      .eq("id", data.attempt_id)
      .eq("session_id", data.session_id)
      .single();
    if (error || !attempt) throw new Error(error?.message || "Result not found");
    if (!attempt.submitted_at) throw new Error("This attempt has not been submitted yet.");
    const test = attempt.test as { show_answers_after_submit?: boolean } | null;
    const safeAttempt = {
      id: attempt.id,
      started_at: attempt.started_at,
      submitted_at: attempt.submitted_at,
      duration_seconds: attempt.duration_seconds,
      total_marks: attempt.total_marks,
      obtained_marks: attempt.obtained_marks,
      skipped_count: attempt.skipped_count,
      attempted_questions: Number(attempt.correct_count ?? 0) + Number(attempt.wrong_count ?? 0),
      percentage: attempt.percentage,
      passed: attempt.passed,
      test: attempt.test,
    };

    if (!test?.show_answers_after_submit) {
      return { attempt: safeAttempt, show_answers_after_submit: false };
    }

    const { data: qs, error: questionsError } = await sb
      .from("test_series_questions")
      .select("sort_order, question:questions(id, question_text, options, correct_answer, explanation, marks, negative_marks, difficulty, image_url)")
      .eq("test_series_id", attempt.test_series_id)
      .order("sort_order");
    if (questionsError) throw new Error(questionsError.message);
    return {
      attempt: safeAttempt,
      show_answers_after_submit: true,
      review: { answers: attempt.answers, questions: qs ?? [] },
    };
  });
