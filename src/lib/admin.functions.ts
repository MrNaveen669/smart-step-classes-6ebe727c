import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(ctx: any) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || `x-${Date.now()}`;
}

// ==================== SUBJECTS ====================
export const adminListSubjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("subjects").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const SubjectInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(30).optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  status: z.enum(["draft", "published", "hidden"]).default("draft"),
});

export const upsertSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubjectInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload: any = { name: data.name, description: data.description, icon: data.icon, color: data.color, status: data.status };
    if (data.id) {
      const { error } = await context.supabase.from("subjects").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    payload.slug = slugify(data.name) + "-" + Math.random().toString(36).slice(2, 6);
    payload.created_by = context.userId;
    const { data: row, error } = await context.supabase.from("subjects").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("subjects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ==================== CHAPTERS ====================
export const adminListChapters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("chapters").select("*, subject:subjects(name)").order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const ChapterInput = z.object({
  id: z.string().optional(),
  subject_id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(["draft", "published", "hidden"]).default("draft"),
});

export const upsertChapter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChapterInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload: any = { subject_id: data.subject_id, name: data.name, description: data.description, status: data.status };
    if (data.id) {
      const { error } = await context.supabase.from("chapters").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    payload.slug = slugify(data.name) + "-" + Math.random().toString(36).slice(2, 6);
    payload.created_by = context.userId;
    const { data: row, error } = await context.supabase.from("chapters").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteChapter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("chapters").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ==================== QUESTION BANKS ====================
export const adminListBanks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("question_banks")
      .select("*, subject:subjects(name), chapter:chapters(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().min(1).max(200),
      subject_id: z.string().nullable().optional(),
      chapter_id: z.string().nullable().optional(),
      file_path: z.string(),
      file_name: z.string(),
      file_type: z.string(),
      file_size: z.number(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("question_banks")
      .insert({ ...data, created_by: context.userId, extraction_status: "pending" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("question_banks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ==================== QUESTIONS ====================
export const adminListQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bank_id: z.string().optional(), subject_id: z.string().optional(), chapter_id: z.string().optional(), search: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase.from("questions").select("*").order("question_number", { ascending: true, nullsFirst: false }).limit(500);
    if (data.bank_id) q = q.eq("question_bank_id", data.bank_id);
    if (data.subject_id) q = q.eq("subject_id", data.subject_id);
    if (data.chapter_id) q = q.eq("chapter_id", data.chapter_id);
    if (data.search) q = q.ilike("question_text", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const QuestionUpdate = z.object({
  id: z.string(),
  question_text: z.string().min(1),
  options: z.array(z.string()).optional(),
  correct_answer: z.any().optional(),
  explanation: z.string().optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  marks: z.number().min(0).max(100),
  negative_marks: z.number().min(0).max(100),
  question_type: z.enum(["single_correct", "multiple_correct", "true_false", "fill_blank", "numerical", "image_based"]).optional(),
  subject_id: z.string().optional().nullable(),
  chapter_id: z.string().optional().nullable(),
  is_reviewed: z.boolean().optional(),
});

export const updateQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => QuestionUpdate.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("questions").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string()).min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("questions").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ==================== TEST SERIES ====================
export const adminListTests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("test_series")
      .select("*, subject:subjects(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const TestInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  subject_id: z.string().nullable().optional(),
  chapter_id: z.string().nullable().optional(),
  instructions: z.string().max(4000).optional().nullable(),
  duration_minutes: z.number().min(1).max(600),
  passing_marks: z.number().min(0),
  negative_marking: z.boolean().default(false),
  negative_mark_value: z.number().min(0).max(10).default(0),
  shuffle_questions: z.boolean().default(false),
  shuffle_options: z.boolean().default(false),
  status: z.enum(["draft", "published", "hidden"]).default("draft"),
  question_ids: z.array(z.string()).default([]),
  expiry_date: z.string().nullable().optional(),
  is_featured: z.boolean().default(false),
  show_answers_after_submit: z.boolean().default(false),
});

export const upsertTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TestInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { question_ids, id, ...fields } = data;

    let totalMarks = 0;
    if (question_ids.length) {
      const { data: qs } = await context.supabase.from("questions").select("id, marks").in("id", question_ids);
      totalMarks = (qs ?? []).reduce((sum, q) => sum + Number(q.marks || 0), 0);
    }

    const payload: any = { ...fields, total_marks: totalMarks };
    let testId = id;
    if (id) {
      const { error } = await context.supabase.from("test_series").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      payload.slug = slugify(fields.name) + "-" + Math.random().toString(36).slice(2, 6);
      payload.created_by = context.userId;
      const { data: row, error } = await context.supabase.from("test_series").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      testId = row.id;
    }

    await context.supabase.from("test_series_questions").delete().eq("test_series_id", testId!);
    if (question_ids.length) {
      const links = question_ids.map((qid, idx) => ({ test_series_id: testId!, question_id: qid, sort_order: idx }));
      const { error } = await context.supabase.from("test_series_questions").insert(links);
      if (error) throw new Error(error.message);
    }
    return { id: testId };
  });

export const deleteTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("test_series").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getTestQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ test_id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("test_series_questions")
      .select("question_id, sort_order")
      .eq("test_series_id", data.test_id)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => r.question_id as string);
  });

// ==================== DASHBOARD STATS ====================
export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const [subs, banks, qs, tests, published, draft] = await Promise.all([
      sb.from("subjects").select("*", { count: "exact", head: true }),
      sb.from("question_banks").select("*", { count: "exact", head: true }),
      sb.from("questions").select("*", { count: "exact", head: true }),
      sb.from("test_series").select("*", { count: "exact", head: true }),
      sb.from("test_series").select("*", { count: "exact", head: true }).eq("status", "published"),
      sb.from("test_series").select("*", { count: "exact", head: true }).eq("status", "draft"),
    ]);
    const { data: recentBanks } = await sb.from("question_banks").select("id, title, extraction_status, question_count, created_at").order("created_at", { ascending: false }).limit(5);
    const { data: recentAttempts } = await sb.from("test_attempts").select("id, student_name, test_series_id, obtained_marks, total_marks, created_at").order("created_at", { ascending: false }).limit(6);
    return {
      subjects: subs.count ?? 0,
      banks: banks.count ?? 0,
      questions: qs.count ?? 0,
      tests: tests.count ?? 0,
      published: published.count ?? 0,
      draft: draft.count ?? 0,
      recentBanks: recentBanks ?? [],
      recentAttempts: recentAttempts ?? [],
    };
  });

export const createBankUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ file_name: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const path = `${context.userId}/${Date.now()}-${data.file_name.replace(/[^\w.\-]+/g, "_")}`;
    const { data: signed, error } = await context.supabase.storage.from("question-banks").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });
