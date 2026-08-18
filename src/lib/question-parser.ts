export type LocallyParsedQuestion = {
  question_number: number | null;
  question_text: string;
  options: string[];
  correct_answer: string | string[] | null;
  explanation: null;
  difficulty: "medium";
  question_type: "single_correct" | "multiple_correct" | "true_false" | "fill_blank";
};

export type AmbiguousQuestionBlock = {
  questionNumber: number | null;
  rawText: string;
  reasons: string[];
};

export type LocalParseResult = {
  questions: LocallyParsedQuestion[];
  ambiguousBlocks: AmbiguousQuestionBlock[];
  detectedCount: number;
  malformedBlockCount: number;
  confidence: number;
  metrics: {
    validQuestionTextPercent: number;
    validStructurePercent: number;
    mappedAnswerPercent: number;
    numberingConsistencyPercent: number;
  };
};

type WorkingBlock = {
  number: number | null;
  questionLines: string[];
  options: Array<{ label: string; text: string }>;
  answerRaw: string | null;
  awaitingAnswer: boolean;
  rawLines: string[];
  lastField: "question" | "option" | "answer";
};

const QUESTION_START = /^\s*(?:(?:q(?:uestion)?\s*)?(\d+))\s*[.):]\s*(.+?)\s*$/i;
const OPTION_LINE = /^\s*(?:\(([A-Z])\)|([A-Z])[.):])\s*(.+?)\s*$/i;
const ANSWER_LINE = /^\s*(?:correct\s+answer|answer|ans)\s*:\s*(.*?)\s*$/i;
const HEADING_LINE = /^\s*(?:(?:module|unit|chapter)\s+[A-Z0-9IVXLC]+|MCQs?|QUESTION\s+BANK|TOTAL\s+QUESTIONS?(?:\s*[:=-]?\s*\d+)?|[=_*\-]{3,})\s*$/i;

function cleanWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripOptionLabel(value: string): string {
  const normalized = cleanWhitespace(value);
  const match = normalized.match(/^(?:\(([A-Z])\)|([A-Z])[.):\-])\s*(.+)$/i);
  return match?.[3] ? cleanWhitespace(match[3]) : normalized;
}

function answerLetter(value: string): string | null {
  const match = cleanWhitespace(value).match(/^(?:\(([A-Z])\)|([A-Z])(?:[.):\-])?)(?:\s+.*)?$/i);
  return (match?.[1] ?? match?.[2] ?? null)?.toUpperCase() ?? null;
}

function splitAnswerTokens(value: string): string[] {
  return cleanWhitespace(value)
    .replace(/\s+and\s+/gi, ",")
    .replace(/\//g, ",")
    .split(",")
    .map(cleanWhitespace)
    .filter(Boolean);
}

function mapAnswerToken(token: string, options: Array<{ label: string; text: string }>): string | null {
  const letter = answerLetter(token);
  if (letter) {
    const option = options.find((candidate) => candidate.label === letter);
    if (option) return option.text;
  }
  const answerText = stripOptionLabel(token).toLocaleLowerCase();
  return options.find((option) => option.text.toLocaleLowerCase() === answerText)?.text ?? null;
}

function finishBlock(block: WorkingBlock): {
  question: LocallyParsedQuestion | null;
  ambiguous: AmbiguousQuestionBlock | null;
  validText: boolean;
  validStructure: boolean;
  mappedAnswer: boolean;
} {
  const questionText = cleanWhitespace(block.questionLines.join(" "));
  const options = block.options.map((option) => option.text).filter(Boolean);
  const reasons: string[] = [];
  const validText = Boolean(questionText);
  if (!validText) reasons.push("empty question text");

  let validStructure = false;
  let mappedAnswer = false;
  let questionType: LocallyParsedQuestion["question_type"] = "single_correct";
  let normalizedOptions = options;
  let correctAnswer: string | string[] | null = null;

  if (options.length >= 2) {
    validStructure = true;
    if (!block.answerRaw) {
      reasons.push("missing answer");
    } else {
      const tokens = splitAnswerTokens(block.answerRaw);
      const mapped = tokens.map((token) => mapAnswerToken(token, block.options));
      if (tokens.length > 0 && mapped.every((answer): answer is string => Boolean(answer))) {
        const uniqueAnswers = [...new Set(mapped)];
        questionType = uniqueAnswers.length > 1 ? "multiple_correct" : "single_correct";
        correctAnswer = uniqueAnswers.length > 1 ? uniqueAnswers : uniqueAnswers[0];
        mappedAnswer = true;
      } else {
        reasons.push("answer could not be mapped to options");
      }
    }
  } else if (options.length === 0 && block.answerRaw) {
    validStructure = true;
    const answer = cleanWhitespace(block.answerRaw).replace(/[.)]$/, "");
    const truthValue = answer.toLowerCase();
    if (["true", "t", "false", "f"].includes(truthValue)) {
      questionType = "true_false";
      normalizedOptions = ["True", "False"];
      correctAnswer = truthValue === "true" || truthValue === "t" ? "True" : "False";
    } else {
      questionType = "fill_blank";
      correctAnswer = answer;
    }
    mappedAnswer = Boolean(correctAnswer);
  } else {
    reasons.push(options.length === 1 ? "only one option detected" : "no options or clear answer detected");
  }

  if (validText && validStructure && mappedAnswer) {
    return {
      question: {
        question_number: block.number,
        question_text: questionText,
        options: normalizedOptions,
        correct_answer: correctAnswer,
        explanation: null,
        difficulty: "medium",
        question_type: questionType,
      },
      ambiguous: null,
      validText,
      validStructure,
      mappedAnswer,
    };
  }

  return {
    question: null,
    ambiguous: {
      questionNumber: block.number,
      rawText: block.rawLines.join("\n").trim(),
      reasons,
    },
    validText,
    validStructure,
    mappedAnswer,
  };
}

function percentage(numerator: number, denominator: number): number {
  return denominator ? Math.round((numerator / denominator) * 100) : 0;
}

export function parseStructuredQuestionBank(text: string): LocalParseResult {
  const lines = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: WorkingBlock[] = [];
  let current: WorkingBlock | null = null;

  const pushCurrent = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const originalLine of lines) {
    const line = originalLine.trimEnd();
    const questionMatch = line.match(QUESTION_START);
    if (questionMatch) {
      pushCurrent();
      current = {
        number: Number(questionMatch[1]),
        questionLines: [questionMatch[2]],
        options: [],
        answerRaw: null,
        awaitingAnswer: false,
        rawLines: [originalLine],
        lastField: "question",
      };
      continue;
    }

    if (!current) continue;
    current.rawLines.push(originalLine);
    const trimmed = line.trim();
    if (!trimmed || HEADING_LINE.test(trimmed)) continue;

    if (current.awaitingAnswer) {
      current.answerRaw = trimmed;
      current.awaitingAnswer = false;
      current.lastField = "answer";
      continue;
    }

    const answerMatch = trimmed.match(ANSWER_LINE);
    if (answerMatch) {
      current.answerRaw = cleanWhitespace(answerMatch[1]) || null;
      current.awaitingAnswer = !current.answerRaw;
      current.lastField = "answer";
      continue;
    }

    const optionMatch = trimmed.match(OPTION_LINE);
    if (optionMatch) {
      current.options.push({
        label: (optionMatch[1] ?? optionMatch[2]).toUpperCase(),
        text: cleanWhitespace(optionMatch[3]),
      });
      current.lastField = "option";
      continue;
    }

    if (current.lastField === "option" && !current.answerRaw && current.options.length) {
      const lastOption = current.options[current.options.length - 1];
      lastOption.text = cleanWhitespace(`${lastOption.text} ${trimmed}`);
    } else if (current.lastField === "question" && !current.answerRaw) {
      current.questionLines.push(trimmed);
    }
  }
  pushCurrent();

  const questions: LocallyParsedQuestion[] = [];
  const ambiguousBlocks: AmbiguousQuestionBlock[] = [];
  let validTextCount = 0;
  let validStructureCount = 0;
  let mappedAnswerCount = 0;
  for (const block of blocks) {
    const result = finishBlock(block);
    if (result.validText) validTextCount += 1;
    if (result.validStructure) validStructureCount += 1;
    if (result.mappedAnswer) mappedAnswerCount += 1;
    if (result.question) questions.push(result.question);
    if (result.ambiguous) ambiguousBlocks.push(result.ambiguous);
  }

  let consistentTransitions = 0;
  for (let index = 1; index < blocks.length; index++) {
    if (blocks[index].number !== null && blocks[index - 1].number !== null && blocks[index].number === blocks[index - 1].number! + 1) {
      consistentTransitions += 1;
    }
  }
  const numberingConsistencyPercent = blocks.length <= 1 ? (blocks.length ? 100 : 0) : percentage(consistentTransitions, blocks.length - 1);
  const metrics = {
    validQuestionTextPercent: percentage(validTextCount, blocks.length),
    validStructurePercent: percentage(validStructureCount, blocks.length),
    mappedAnswerPercent: percentage(mappedAnswerCount, blocks.length),
    numberingConsistencyPercent,
  };
  const confidence = Math.round(
    metrics.validQuestionTextPercent * 0.25
    + metrics.validStructurePercent * 0.25
    + metrics.mappedAnswerPercent * 0.3
    + metrics.numberingConsistencyPercent * 0.2,
  );

  return {
    questions,
    ambiguousBlocks,
    detectedCount: blocks.length,
    malformedBlockCount: ambiguousBlocks.length,
    confidence,
    metrics,
  };
}
