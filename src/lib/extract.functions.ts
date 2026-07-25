import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SYSTEM_PROMPT = `You are an expert at extracting quiz/exam questions from raw text.
You will receive plain text from a PDF/DOCX/TXT question bank. Return STRICT JSON only.

Detect two possible layouts:
 (A) Answer appears inline after each question (e.g. "Answer: C" or "Ans: B").
 (B) A separate answer key at the end (e.g. "1-C, 2-D, 3-A" or "Answers: 1) B  2) A ...").
In layout (B), map each numbered answer back to the corresponding question number.

For each question extract: question_number (integer if present), question_text, options (array of strings without letter prefixes like "A)" — strip those), correct_answer (the correct option TEXT, or an array for multiple-correct), explanation (if present), difficulty ("easy"|"medium"|"hard" if hinted, else "medium"), question_type ("single_correct"|"multiple_correct"|"true_false"|"fill_blank"|"numerical"|"image_based").

Return JSON of this exact shape and NOTHING else — no markdown fences, no commentary:
{ "questions": [ { "question_number": 1, "question_text": "...", "options": ["...","..."], "correct_answer": "option text", "explanation": "...", "difficulty": "medium", "question_type": "single_correct" } ] }

If you cannot find any questions, return { "questions": [] }.`;

async function extractText(fileBytes: ArrayBuffer, fileType: string, fileName: string): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (fileType.startsWith("text/") || ext === "txt") {
    return new TextDecoder().decode(fileBytes);
  }
  if (fileType === "application/pdf" || ext === "pdf") {
    const { extractText: unExtract, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(fileBytes));
    const { text } = await unExtract(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }
  throw new Error(`Unsupported file type "${fileType || ext}". Please upload a PDF or TXT file. DOCX support coming soon — convert to PDF or TXT for now.`);
}

function safeJson(s: string): any {
  // Strip markdown fences and any leading/trailing prose
  let t = s.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return JSON.parse(t);
}

export const extractQuestionsFromBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bank_id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    // Admin check
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

    // Load bank
    const { data: bank, error: bErr } = await context.supabase.from("question_banks").select("*").eq("id", data.bank_id).single();
    if (bErr || !bank) throw new Error(bErr?.message || "Bank not found");
    if (!bank.file_path) throw new Error("Bank has no file");

    // Mark processing
    await context.supabase.from("question_banks").update({ extraction_status: "processing", extraction_error: null }).eq("id", data.bank_id);

    try {
      // Download file
      const { data: dl, error: dlErr } = await context.supabase.storage.from("question-banks").download(bank.file_path);
      if (dlErr || !dl) throw new Error(dlErr?.message || "Download failed");
      const buf = await dl.arrayBuffer();
      const text = await extractText(buf, bank.file_type ?? "", bank.file_name ?? "");
      if (!text.trim()) throw new Error("Empty document — if this is a scanned PDF, OCR support is not yet available in V1. Convert to a text-based PDF or TXT and re-upload.");

      // Chunk if huge (Nemotron has ~128k context; keep under safe cap)
      const MAX = 60000;
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += MAX) chunks.push(text.slice(i, i + MAX));

      const allQuestions: any[] = [];
      for (const chunk of chunks) {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://lovable.dev",
            "X-Title": "Test Series Platform",
          },
          body: JSON.stringify({
            model: "nvidia/nemotron-3-ultra-550b-a55b:free",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: `Extract questions from this document text:\n\n${chunk}` },
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
          }),
        });

        if (res.status === 429) throw new Error("Rate limit hit on the AI provider. Please wait a minute and retry.");
        if (res.status === 402) throw new Error("AI provider credits exhausted.");
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`AI provider error (${res.status}): ${txt.slice(0, 300)}`);
        }
        const json: any = await res.json();
        const content = json?.choices?.[0]?.message?.content ?? "";
        let parsed: any;
        try {
          parsed = safeJson(content);
        } catch {
          throw new Error("AI returned malformed JSON. Try re-running extraction.");
        }
        if (Array.isArray(parsed?.questions)) allQuestions.push(...parsed.questions);
      }

      if (!allQuestions.length) {
        await context.supabase.from("question_banks").update({ extraction_status: "failed", extraction_error: "No questions found in document." }).eq("id", data.bank_id);
        return { ok: false, count: 0, error: "No questions found." };
      }

      // Normalize and insert
      const validTypes = ["single_correct", "multiple_correct", "true_false", "fill_blank", "numerical", "image_based"];
      const validDiff = ["easy", "medium", "hard"];
      const rows = allQuestions
        .filter((q: any) => q && typeof q.question_text === "string" && q.question_text.trim())
        .map((q: any) => ({
          question_bank_id: bank.id,
          subject_id: bank.subject_id,
          chapter_id: bank.chapter_id,
          question_number: typeof q.question_number === "number" ? q.question_number : null,
          question_type: validTypes.includes(q.question_type) ? q.question_type : "single_correct",
          question_text: String(q.question_text).slice(0, 4000),
          options: Array.isArray(q.options) ? q.options.map((o: any) => String(o).slice(0, 800)) : [],
          correct_answer: q.correct_answer ?? null,
          explanation: q.explanation ? String(q.explanation).slice(0, 3000) : null,
          difficulty: validDiff.includes(q.difficulty) ? q.difficulty : "medium",
          marks: 1,
          negative_marks: 0,
          created_by: context.userId,
          is_reviewed: false,
        }));

      if (rows.length) {
        const { error: insErr } = await context.supabase.from("questions").insert(rows);
        if (insErr) throw new Error(insErr.message);
      }

      await context.supabase
        .from("question_banks")
        .update({ extraction_status: "completed", question_count: rows.length, extraction_error: null })
        .eq("id", data.bank_id);

      return { ok: true, count: rows.length };
    } catch (err: any) {
      await context.supabase
        .from("question_banks")
        .update({ extraction_status: "failed", extraction_error: String(err?.message ?? err).slice(0, 500) })
        .eq("id", data.bank_id);
      throw err;
    }
  });