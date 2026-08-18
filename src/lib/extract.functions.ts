import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseStructuredQuestionBank } from "@/lib/question-parser";
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

const OPENROUTER_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

const QUESTION_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question_number: { type: ["number", "string", "null"] },
          question_text: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correct_answer: {
            anyOf: [
              { type: "string" },
              { type: "array", items: { type: "string" } },
              { type: "null" },
            ],
          },
          explanation: { type: ["string", "null"] },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          question_type: {
            type: "string",
            enum: ["single_correct", "multiple_correct", "true_false", "fill_blank", "numerical", "image_based"],
          },
        },
        required: ["question_number", "question_text", "options", "correct_answer", "explanation", "difficulty", "question_type"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

function buildOpenRouterBody(chunk: string, strict: boolean) {
  return {
    model: OPENROUTER_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Extract questions from this document text:\n\n${chunk}` },
    ],
    stream: false,
    temperature: 0.1,
    response_format: strict
      ? {
          type: "json_schema",
          json_schema: {
            name: "question_extraction",
            strict: true,
            schema: QUESTION_EXTRACTION_SCHEMA,
          },
        }
      : { type: "json_object" },
    provider: strict ? { require_parameters: true } : undefined,
    plugins: [{ id: "response-healing" }],
  };
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizedPreview(value: string, limit: number): string {
  return normalizeWhitespace(value)
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/(?:sk-or-v1-|eyJ)[A-Za-z0-9._-]{12,}/g, "[redacted]")
    .slice(0, limit);
}

function isStructuredOutputUnsupported(status: number, responseText: string): boolean {
  if (![400, 404, 422].includes(status)) return false;
  return /(response[_ -]?format|json[_ -]?schema|structured output|require[_ -]?parameters|no endpoints|provider.*support)/i.test(responseText);
}

function logOpenRouterDiagnostics(label: string, status: number, payload: any, content: string) {
  const choice = payload?.choices?.[0];
  console.error(`[question-extraction] ${label}`, {
    http_status: status,
    model: typeof payload?.model === "string" ? payload.model : null,
    finish_reason: typeof choice?.finish_reason === "string" ? choice.finish_reason : null,
    content_exists: Boolean(content),
    content_preview: sanitizedPreview(content, 1000),
  });
}

type QuestionType = "single_correct" | "multiple_correct" | "true_false" | "fill_blank" | "numerical" | "image_based";
type Difficulty = "easy" | "medium" | "hard";

type NormalizedQuestion = {
  question_number: number | null;
  question_text: string;
  options: string[];
  correct_answer: string | string[] | null;
  explanation: string | null;
  difficulty: Difficulty;
  question_type: QuestionType;
};

type QuestionNormalizationResult = {
  question: NormalizedQuestion | null;
  normalized: boolean;
  issuePath?: string;
  reason?: string;
};

function normalizeQuestionType(value: unknown): QuestionType {
  const normalized = normalizeWhitespace(String(value ?? ""))
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const aliases: Record<string, QuestionType> = {
    mcq: "single_correct",
    single: "single_correct",
    single_choice: "single_correct",
    single_correct: "single_correct",
    multiple: "multiple_correct",
    multiple_choice: "multiple_correct",
    multiple_correct: "multiple_correct",
    multi_choice: "multiple_correct",
    multi_select: "multiple_correct",
    checkbox: "multiple_correct",
    true_false: "true_false",
    truefalse: "true_false",
    boolean: "true_false",
    fill_blank: "fill_blank",
    fill_in_blank: "fill_blank",
    fill_in_the_blank: "fill_blank",
    numerical: "numerical",
    numeric: "numerical",
    number: "numerical",
    image_based: "image_based",
    image: "image_based",
  };
  return aliases[normalized] ?? "single_correct";
}

function stripOptionLabel(value: string): string {
  const normalized = normalizeWhitespace(value);
  const match = normalized.match(/^(?:\(([A-Z])\)|([A-Z])[.):\-])\s*(.+)$/i);
  return match?.[3] ? normalizeWhitespace(match[3]) : normalized;
}

function optionLetterIndex(value: string): number | null {
  const match = normalizeWhitespace(value).match(/^(?:\(([A-Z])\)|([A-Z])(?:[.):\-])?)(?:\s+.*)?$/i);
  const letter = match?.[1] ?? match?.[2];
  return letter ? letter.toUpperCase().charCodeAt(0) - 65 : null;
}

function mapAnswerToOption(value: unknown, options: string[], questionType: QuestionType): string | null {
  const normalized = normalizeWhitespace(String(value ?? ""));
  if (!normalized) return null;

  if (questionType === "true_false") {
    const truthValue = normalized.toLowerCase().replace(/[.)]/g, "");
    if (truthValue === "true" || truthValue === "t") return "True";
    if (truthValue === "false" || truthValue === "f") return "False";
  }

  const letterIndex = optionLetterIndex(normalized);
  if (letterIndex !== null && letterIndex >= 0 && letterIndex < options.length) return options[letterIndex];

  const answerText = stripOptionLabel(normalized).toLocaleLowerCase();
  return options.find((option) => option.toLocaleLowerCase() === answerText) ?? null;
}

function normalizeQuestion(q: any): QuestionNormalizationResult {
  if (!q || typeof q.question_text !== "string" || !normalizeWhitespace(q.question_text)) {
    return { question: null, normalized: false, issuePath: "question_text", reason: "empty question_text" };
  }

  let questionType = normalizeQuestionType(q.question_type);
  const optionlessType = questionType === "fill_blank" || questionType === "numerical";
  if (!Array.isArray(q.options) && !optionlessType) {
    return { question: null, normalized: false, issuePath: "options", reason: "options is not an array" };
  }

  let options: string[] = Array.isArray(q.options)
    ? q.options.map((option: any) => stripOptionLabel(String(option))).filter(Boolean)
    : [];
  if (questionType === "true_false") options = ["True", "False"];
  if ((questionType === "single_correct" || questionType === "multiple_correct" || questionType === "image_based") && options.length < 2) {
    return { question: null, normalized: false, issuePath: "options", reason: "option-based question has fewer than two options" };
  }

  const rawAnswer = q.correct_answer ?? null;
  let correctAnswer: string | string[] | null = null;
  if (questionType === "multiple_correct") {
    const rawAnswers = rawAnswer === null
      ? []
      : Array.isArray(rawAnswer)
        ? rawAnswer
        : String(rawAnswer).split(/[,;|]/);
    const mappedAnswers = rawAnswers
      .map((answer) => mapAnswerToOption(answer, options, questionType))
      .filter((answer): answer is string => Boolean(answer));
    correctAnswer = mappedAnswers.length ? [...new Set(mappedAnswers)] : null;
  } else if (questionType === "single_correct" || questionType === "true_false" || questionType === "image_based") {
    const rawAnswers = Array.isArray(rawAnswer) ? rawAnswer : [rawAnswer];
    if (questionType === "single_correct" && rawAnswers.filter((answer) => answer != null).length > 1) {
      questionType = "multiple_correct";
      const mappedAnswers = rawAnswers
        .map((answer) => mapAnswerToOption(answer, options, questionType))
        .filter((answer): answer is string => Boolean(answer));
      correctAnswer = mappedAnswers.length ? [...new Set(mappedAnswers)] : null;
    } else {
      correctAnswer = rawAnswer === null ? null : mapAnswerToOption(rawAnswers[0], options, questionType);
    }
  } else if (rawAnswer !== null) {
    if (Array.isArray(rawAnswer)) {
      const answers = rawAnswer.map((answer) => normalizeWhitespace(String(answer))).filter(Boolean);
      correctAnswer = answers.length ? answers : null;
    } else {
      correctAnswer = normalizeWhitespace(String(rawAnswer)) || null;
    }
  }

  let questionNumber: number | null = null;
  if (typeof q.question_number === "number" && Number.isFinite(q.question_number)) questionNumber = q.question_number;
  if (typeof q.question_number === "string" && /^\d+(?:\.\d+)?$/.test(q.question_number.trim())) questionNumber = Number(q.question_number);

  const difficultyValue = normalizeWhitespace(String(q.difficulty ?? "")).toLowerCase();
  const difficulty: Difficulty = difficultyValue === "easy" || difficultyValue === "hard" ? difficultyValue : "medium";
  const question: NormalizedQuestion = {
    question_number: questionNumber,
    question_text: normalizeWhitespace(q.question_text).slice(0, 4000),
    options: options.map((option) => option.slice(0, 800)),
    correct_answer: correctAnswer,
    explanation: typeof q.explanation === "string" ? normalizeWhitespace(q.explanation).slice(0, 3000) || null : null,
    difficulty,
    question_type: questionType,
  };

  const comparableRaw = {
    question_number: q.question_number ?? null,
    question_text: q.question_text,
    options: q.options ?? [],
    correct_answer: q.correct_answer ?? null,
    explanation: q.explanation ?? null,
    difficulty: q.difficulty ?? "medium",
    question_type: q.question_type ?? "single_correct",
  };

  return {
    question,
    normalized: JSON.stringify(comparableRaw) !== JSON.stringify(question),
  };
}

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

function coerceAiQuestions(parsed: any): any[] | null {
  const candidates = Array.isArray(parsed?.questions)
    ? parsed.questions
    : Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && (parsed.question_text || parsed.question || parsed.text)
        ? [parsed]
        : null;
  if (!candidates) return null;

  return candidates.map((question: any) => ({
    question_number: question?.question_number ?? question?.number ?? null,
    question_text: question?.question_text ?? question?.question ?? question?.text ?? "",
    options: question?.options ?? question?.choices ?? [],
    correct_answer: question?.correct_answer ?? question?.answer ?? null,
    explanation: question?.explanation ?? null,
    difficulty: question?.difficulty ?? "medium",
    question_type: question?.question_type ?? question?.type ?? "single_correct",
  }));
}

export const extractQuestionsFromBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bank_id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const startedAt = Date.now();
    // Admin check
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    // Load bank
    const { data: bank, error: bErr } = await context.supabase.from("question_banks").select("*").eq("id", data.bank_id).single();
    if (bErr || !bank) throw new Error(bErr?.message || "Bank not found");
    if (!bank.file_path) throw new Error("Bank has no file");

    // Mark processing
    await context.supabase
      .from("question_banks")
      .update({
        extraction_status: "processing",
        extraction_error: null,
        extraction_meta: { phase: "reading", completed_chunks: 0, total_chunks: 0, progress: null, extracted_count: 0 },
      })
      .eq("id", data.bank_id);

    try {
      // Download file
      const { data: dl, error: dlErr } = await context.supabase.storage.from("question-banks").download(bank.file_path);
      if (dlErr || !dl) throw new Error(dlErr?.message || "Download failed");
      const buf = await dl.arrayBuffer();
      const text = await extractText(buf, bank.file_type ?? "", bank.file_name ?? "");
      if (!text.trim()) throw new Error("Empty document — if this is a scanned PDF, OCR support is not yet available in V1. Convert to a text-based PDF or TXT and re-upload.");
      console.info("[question-extraction] Document text extracted", {
        bank_id: bank.id,
        file_type: bank.file_type ?? null,
        text_length: text.length,
        text_preview: sanitizedPreview(text, 300),
      });

      await context.supabase
        .from("question_banks")
        .update({ extraction_meta: { phase: "parsing_local", progress: null, extracted_count: 0 } })
        .eq("id", data.bank_id);

      const localResult = parseStructuredQuestionBank(text);
      const useFullAiFallback = localResult.confidence < 60 || localResult.detectedCount === 0;
      const strategy = useFullAiFallback
        ? "full-ai-fallback"
        : localResult.ambiguousBlocks.length
          ? "hybrid-partial"
          : "deterministic";
      const allQuestions: any[] = useFullAiFallback ? [] : [...localResult.questions];
      const aiInputText = strategy === "full-ai-fallback"
        ? text
        : strategy === "hybrid-partial"
          ? localResult.ambiguousBlocks.map((block) => block.rawText).join("\n\n")
          : "";

      await context.supabase
        .from("question_banks")
        .update({
          extraction_meta: {
            phase: "validating_local",
            progress: null,
            strategy,
            local_detected_count: localResult.detectedCount,
            local_accepted_count: useFullAiFallback ? 0 : localResult.questions.length,
            ambiguous_count: localResult.ambiguousBlocks.length,
            local_confidence: localResult.confidence,
            extracted_count: allQuestions.length,
          },
        })
        .eq("id", data.bank_id);

      console.info("[Extraction] Local parser decision", {
        file: bank.file_name ?? null,
        textLength: text.length,
        localQuestionsDetected: localResult.detectedCount,
        localConfidence: `${localResult.confidence}%`,
        localAccepted: useFullAiFallback ? 0 : localResult.questions.length,
        ambiguousBlocks: localResult.ambiguousBlocks.length,
        malformedBlocks: localResult.malformedBlockCount,
        strategy,
        metrics: localResult.metrics,
      });

      // Chunk only the text that actually needs AI; deterministic questions never leave the server.
      const MAX = 60000;
      const chunks: string[] = [];
      for (let i = 0; i < aiInputText.length; i += MAX) chunks.push(aiInputText.slice(i, i + MAX));
      if (chunks.length) {
        await context.supabase
          .from("question_banks")
          .update({
            extraction_meta: {
              phase: "ai_fallback",
              completed_chunks: 0,
              total_chunks: chunks.length,
              progress: 0,
              strategy,
              local_detected_count: localResult.detectedCount,
              local_accepted_count: useFullAiFallback ? 0 : localResult.questions.length,
              ambiguous_count: localResult.ambiguousBlocks.length,
              local_confidence: localResult.confidence,
              extracted_count: allQuestions.length,
            },
          })
          .eq("id", data.bank_id);
      }

      const RETRY_DELAYS_MS = [5000, 15000, 30000];
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      let strictStructuredOutputAvailable: boolean | null = null;
      let aiRequests = 0;
      const apiKey = chunks.length ? process.env.OPENROUTER_API_KEY : null;
      if (chunks.length && !apiKey) throw new Error("OPENROUTER_API_KEY not configured for AI fallback");

      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];
        // Throttle between chunks to avoid burst rate limits
        if (ci > 0) await sleep(2000);

        let lastErr: Error | null = null;
        let success = false;
        for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
          const request = (strict: boolean) => {
            aiRequests += 1;
            return fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://lovable.dev",
                "X-Title": "Test Series Platform",
              },
              body: JSON.stringify(buildOpenRouterBody(chunk, strict)),
            });
          };
          const tryStrict = strictStructuredOutputAvailable !== false;
          let res = await request(tryStrict);
          let responseText = await res.text().catch(() => "");
          let usedFallback = !tryStrict;

          if (tryStrict && !res.ok && isStructuredOutputUnsupported(res.status, responseText)) {
            console.warn("[question-extraction] Strict json_schema is unavailable for the configured free model/provider; retrying with free-model JSON mode and response healing.", {
              http_status: res.status,
              model: OPENROUTER_MODEL,
              provider_error: sanitizedPreview(responseText, 500),
            });
            strictStructuredOutputAvailable = false;
            res = await request(false);
            responseText = await res.text().catch(() => "");
            usedFallback = true;
          } else if (tryStrict && res.ok) {
            strictStructuredOutputAvailable = true;
          }

          if (res.status === 429) {
            if (attempt < RETRY_DELAYS_MS.length) {
              await sleep(RETRY_DELAYS_MS[attempt]);
              continue;
            }
            lastErr = new Error("The AI service is busy right now. Please wait a minute and try again.");
            break;
          }
          if (res.status === 402) {
            lastErr = new Error("AI provider credits exhausted.");
            break;
          }
          if (!res.ok) {
            // Retry transient 5xx
            if (res.status >= 500 && attempt < RETRY_DELAYS_MS.length) {
              await sleep(RETRY_DELAYS_MS[attempt]);
              continue;
            }
            let errorPayload: any = null;
            try {
              errorPayload = JSON.parse(responseText);
            } catch {
              // The diagnostic below safely handles non-JSON provider errors.
            }
            logOpenRouterDiagnostics("OpenRouter request failed", res.status, errorPayload, responseText);
            lastErr = new Error(
              usedFallback
                ? "The configured free AI model could not produce structured output. Try re-running extraction later."
                : `AI provider error (${res.status}). Try re-running extraction.`,
            );
            break;
          }

          let json: any;
          try {
            json = JSON.parse(responseText);
          } catch {
            logOpenRouterDiagnostics("OpenRouter returned a non-JSON API response", res.status, null, responseText);
            lastErr = new Error("AI provider returned an invalid response. Try re-running extraction.");
            break;
          }
          const content = json?.choices?.[0]?.message?.content ?? "";
          let parsed: any;
          try {
            parsed = safeJson(content);
          } catch {
            logOpenRouterDiagnostics("AI content JSON parsing failed", res.status, json, content);
            lastErr = new Error("AI returned invalid structured question data. Try re-running extraction.");
            break;
          }
          const aiQuestions = coerceAiQuestions(parsed);
          if (!aiQuestions) {
            logOpenRouterDiagnostics("AI response did not contain a questions array", res.status, json, content);
            lastErr = new Error("AI returned invalid structured question data. Try re-running extraction.");
            break;
          }
          if (!Array.isArray(parsed?.questions)) {
            console.warn("[question-extraction] Normalized non-standard AI response envelope", {
              bank_id: bank.id,
              chunk: ci + 1,
              returned_keys: parsed && typeof parsed === "object" ? Object.keys(parsed).slice(0, 20) : [],
              validation_issue_path: "questions",
              validation_issue_message: "Expected questions array; received a single question object or top-level array",
              raw_response_preview: sanitizedPreview(JSON.stringify(parsed), 1000),
            });
          }
          if (aiQuestions.length === 0 && attempt === 0) {
            console.warn("[question-extraction] AI returned zero questions for a non-empty chunk; retrying once.", {
              bank_id: bank.id,
              chunk: ci + 1,
              chunk_length: chunk.length,
              chunk_preview: sanitizedPreview(chunk, 300),
              structured_output_mode: usedFallback ? "json_object_fallback" : "strict_json_schema",
            });
            await sleep(2000);
            continue;
          }
          allQuestions.push(...aiQuestions);
          const completedChunks = ci + 1;
          const progress = Math.round((completedChunks / chunks.length) * 100);
          await context.supabase
            .from("question_banks")
            .update({
              extraction_meta: {
                phase: "ai_fallback",
                completed_chunks: completedChunks,
                total_chunks: chunks.length,
                progress,
                strategy,
                local_detected_count: localResult.detectedCount,
                local_accepted_count: useFullAiFallback ? 0 : localResult.questions.length,
                ambiguous_count: localResult.ambiguousBlocks.length,
                local_confidence: localResult.confidence,
                extracted_count: allQuestions.length,
                ai_requests: aiRequests,
              },
            })
            .eq("id", data.bank_id);
          console.info("[question-extraction] AI chunk processed", {
            bank_id: bank.id,
            chunk: ci + 1,
            chunk_count: chunks.length,
            extracted_question_count: aiQuestions.length,
            structured_output_mode: usedFallback ? "json_object_fallback" : "strict_json_schema",
          });
          success = true;
          break;
        }

        if (!success && lastErr) {
          await context.supabase
            .from("question_banks")
            .update({ extraction_status: "failed", extraction_error: lastErr.message.slice(0, 500), extraction_meta: { phase: "failed" } })
            .eq("id", data.bank_id);
          return { ok: false, count: 0, error: lastErr.message };
        }
      }

      if (!allQuestions.length) {
        console.warn("[question-extraction] Extraction produced zero usable question candidates", {
          bank_id: bank.id,
          text_length: text.length,
          chunk_count: chunks.length,
          strategy,
          local_detected_count: localResult.detectedCount,
          ai_requests: aiRequests,
          text_preview: sanitizedPreview(text, 300),
        });
        await context.supabase
          .from("question_banks")
          .update({ extraction_status: "failed", extraction_error: "No questions found in document.", extraction_meta: { phase: "failed" } })
          .eq("id", data.bank_id);
        return { ok: false, count: 0, error: "No questions found." };
      }

      // Normalize and insert
      const normalizedQuestions: NormalizedQuestion[] = [];
      const invalidReasons = new Map<string, number>();
      let normalizedCount = 0;
      for (let questionIndex = 0; questionIndex < allQuestions.length; questionIndex++) {
        const rawQuestion = allQuestions[questionIndex];
        const result = normalizeQuestion(rawQuestion);
        if (result.question) {
          normalizedQuestions.push(result.question);
          if (result.normalized) normalizedCount += 1;
        } else {
          const reason = result.reason ?? "unknown validation error";
          invalidReasons.set(reason, (invalidReasons.get(reason) ?? 0) + 1);
          console.warn("[question-extraction] Skipped unusable question", {
            bank_id: bank.id,
            question_index: questionIndex,
            question_number: rawQuestion?.question_number ?? null,
            question_type: rawQuestion?.question_type ?? null,
            options_count: Array.isArray(rawQuestion?.options) ? rawQuestion.options.length : null,
            correct_answer_type: rawQuestion?.correct_answer === null ? "null" : Array.isArray(rawQuestion?.correct_answer) ? "array" : typeof rawQuestion?.correct_answer,
            validation_issue_path: result.issuePath ?? null,
            validation_issue_message: reason,
            raw_question_preview: sanitizedPreview(JSON.stringify(rawQuestion ?? null), 1000),
          });
        }
      }
      console.info("[question-extraction] Normalization summary", {
        bank_id: bank.id,
        strategy,
        candidate_questions: allQuestions.length,
        local_accepted: useFullAiFallback ? 0 : localResult.questions.length,
        ai_requests: aiRequests,
        accepted: normalizedQuestions.length,
        normalized: normalizedCount,
        skipped: allQuestions.length - normalizedQuestions.length,
      });
      if (invalidReasons.size) {
        console.warn("[question-extraction] Skipped invalid extracted questions", {
          bank_id: bank.id,
          skipped_count: allQuestions.length - normalizedQuestions.length,
          reasons: Object.fromEntries(invalidReasons),
        });
      }

      if (!normalizedQuestions.length) {
        const message = "Questions were detected, but none passed validation. Check option and answer formatting, then retry.";
        await context.supabase
          .from("question_banks")
          .update({ extraction_status: "failed", extraction_error: message, extraction_meta: { phase: "failed" } })
          .eq("id", data.bank_id);
        return { ok: false, count: 0, error: message };
      }

      await context.supabase
        .from("question_banks")
        .update({
          extraction_meta: {
            phase: "saving",
            completed_chunks: chunks.length,
            total_chunks: chunks.length,
            progress: chunks.length ? 100 : null,
            strategy,
            local_detected_count: localResult.detectedCount,
            local_accepted_count: useFullAiFallback ? 0 : localResult.questions.length,
            ambiguous_count: localResult.ambiguousBlocks.length,
            local_confidence: localResult.confidence,
            extracted_count: allQuestions.length,
            accepted_count: normalizedQuestions.length,
            skipped_count: allQuestions.length - normalizedQuestions.length,
            ai_requests: aiRequests,
          },
        })
        .eq("id", data.bank_id);

      const rows = normalizedQuestions.map((q) => ({
        question_bank_id: bank.id,
        subject_id: bank.subject_id,
        chapter_id: bank.chapter_id,
        question_number: q.question_number,
        question_type: q.question_type,
        question_text: q.question_text,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        marks: 1,
        negative_marks: 0,
        created_by: context.userId,
        is_reviewed: false,
      }));

      const { data: existingQuestions, error: existingErr } = await context.supabase
        .from("questions")
        .select("id, is_reviewed, question_text")
        .eq("question_bank_id", bank.id);
      if (existingErr) throw new Error(existingErr.message);

      const previousDraftIds = (existingQuestions ?? []).filter((question) => !question.is_reviewed).map((question) => question.id);
      const reviewedQuestionTexts = new Set(
        (existingQuestions ?? [])
          .filter((question) => question.is_reviewed)
          .map((question) => normalizeWhitespace(question.question_text).toLocaleLowerCase()),
      );
      const freshRows = rows.filter((row) => !reviewedQuestionTexts.has(normalizeWhitespace(row.question_text).toLocaleLowerCase()));
      let insertedIds: string[] = [];
      if (freshRows.length) {
        const { data: insertedQuestions, error: insErr } = await context.supabase.from("questions").insert(freshRows).select("id");
        if (insErr) throw new Error(insErr.message);
        insertedIds = (insertedQuestions ?? []).map((question) => question.id);
      }

      if (previousDraftIds.length) {
        const { error: deleteErr } = await context.supabase.from("questions").delete().in("id", previousDraftIds);
        if (deleteErr) {
          if (insertedIds.length) {
            const { error: cleanupErr } = await context.supabase.from("questions").delete().in("id", insertedIds);
            if (cleanupErr) console.error("[question-extraction] Failed to roll back newly inserted questions", { bank_id: bank.id, inserted_count: insertedIds.length });
          }
          throw new Error(`Could not replace previous draft extraction: ${deleteErr.message}`);
        }
      }

      const { count: finalQuestionCount, error: countErr } = await context.supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("question_bank_id", bank.id);
      if (countErr) throw new Error(countErr.message);
      const finalCount = finalQuestionCount ?? freshRows.length + reviewedQuestionTexts.size;
      const durationMs = Date.now() - startedAt;

      await context.supabase
        .from("question_banks")
        .update({
          extraction_status: "completed",
          question_count: finalCount,
          extraction_error: null,
          extraction_meta: {
            phase: "completed",
            completed_chunks: chunks.length,
            total_chunks: chunks.length,
            progress: 100,
            strategy,
            local_detected_count: localResult.detectedCount,
            local_accepted_count: useFullAiFallback ? 0 : localResult.questions.length,
            ambiguous_count: localResult.ambiguousBlocks.length,
            local_confidence: localResult.confidence,
            extracted_count: allQuestions.length,
            accepted_count: normalizedQuestions.length,
            inserted_count: freshRows.length,
            preserved_reviewed_count: reviewedQuestionTexts.size,
            replaced_draft_count: previousDraftIds.length,
            normalized_count: normalizedCount,
            skipped_count: allQuestions.length - normalizedQuestions.length,
            ai_requests: aiRequests,
            duration_ms: durationMs,
          },
        })
        .eq("id", data.bank_id);

      console.info("[Extraction] Completed", {
        file: bank.file_name ?? null,
        textLength: text.length,
        localQuestionsDetected: localResult.detectedCount,
        localConfidence: `${localResult.confidence}%`,
        strategy,
        AIRequests: aiRequests,
        accepted: normalizedQuestions.length,
        inserted: freshRows.length,
        skipped: allQuestions.length - normalizedQuestions.length,
        durationMs,
      });

      return { ok: true, count: finalCount, strategy, aiRequests, durationMs };
    } catch (err: any) {
      const msg = String(err?.message ?? err).slice(0, 500);
      await context.supabase
        .from("question_banks")
        .update({ extraction_status: "failed", extraction_error: msg, extraction_meta: { phase: "failed" } })
        .eq("id", data.bank_id);
      return { ok: false, count: 0, error: msg };
    }
  });
