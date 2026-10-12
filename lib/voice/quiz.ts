/**
 * Shared voice-quiz helpers.
 *
 * Powers the AI quiz mode: the voice assistant asks questions, listens to
 * spoken answers, and gives gentle feedback. Designed for ADHD and autistic
 * kids:
 *
 * - Predictable structure: question count stated upfront, "Question N of M"
 *   on every turn — no surprises.
 * - Short sessions: 3-5 questions default. Kid can stop anytime ("stop").
 * - Literal, simple language. No idioms, no trick questions.
 * - No time pressure: never count down, never rush.
 * - Gentle corrections: factual ("The answer is X.") never shaming ("Wrong!").
 * - Visual + audio: every question also renders as text with tappable choices.
 * - Multiple choice on request ("easier") for kids who struggle with recall.
 *
 * Avoids `@/` imports so the Worker bundle can import via relative path.
 */

export const VOICE_QUIZ_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";
export const VOICE_QUIZ_MAX_QUESTIONS = 5;
export const VOICE_QUIZ_MIN_QUESTIONS = 3;

export interface QuizTurn {
  question: string;
  choices?: string[];
  userAnswer?: string;
  correct?: boolean;
}

export type QuizAction = "start" | "answer";

export interface QuizRequest {
  action: QuizAction;
  /** Topic, e.g. "dinosaurs". Required for start. */
  topic?: string;
  /** Kid's age for age-appropriate language. */
  age?: number;
  /** Previous turns, for context and to avoid repeats. */
  history?: QuizTurn[];
  /** Spoken answer, for the answer action. */
  answer?: string;
  /** When true, always include multiple-choice options. */
  easyMode?: boolean;
}

export type QuizValidation =
  | { ok: true; value: Required<Pick<QuizRequest, "action">> & QuizRequest }
  | { ok: false; error: string };

export function validateQuizInput(body: unknown): QuizValidation {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;
  if (b.action !== "start" && b.action !== "answer") {
    return { ok: false, error: "action must be start or answer." };
  }
  if (b.action === "start" && (typeof b.topic !== "string" || !b.topic.trim())) {
    return { ok: false, error: "topic must be a non-empty string to start." };
  }
  if (b.action === "answer" && typeof b.answer !== "string") {
    return { ok: false, error: "answer must be a string." };
  }
  const history: QuizTurn[] = Array.isArray(b.history)
    ? b.history
        .filter((h): h is Record<string, unknown> => h !== null && typeof h === "object")
        .map((h) => ({
          question: String(h.question ?? "").slice(0, 300),
          choices: Array.isArray(h.choices) ? h.choices.map(String).slice(0, 4) : undefined,
          userAnswer: typeof h.userAnswer === "string" ? h.userAnswer.slice(0, 200) : undefined,
          correct: typeof h.correct === "boolean" ? h.correct : undefined,
        }))
        .slice(-8)
    : [];
  return {
    ok: true,
    value: {
      action: b.action,
      topic: typeof b.topic === "string" ? b.topic.trim().slice(0, 100) : undefined,
      age: typeof b.age === "number" && b.age >= 3 && b.age <= 14 ? Math.floor(b.age) : undefined,
      history,
      answer: typeof b.answer === "string" ? b.answer.trim().slice(0, 200) : undefined,
      easyMode: b.easyMode === true,
    },
  };
}

export interface QuizQuestion {
  question: string;
  choices?: string[];
  /** Exact text the TTS should speak, including "Question N of M". */
  spoken: string;
}

export interface QuizFeedback {
  correct: boolean;
  /** Gentle spoken feedback, e.g. "Yes! ..." or "Good try! The answer is ...". */
  feedback: string;
  next: QuizQuestion | null;
  done: boolean;
  score: { correct: number; total: number };
}

export function questionCount(age?: number): number {
  // Shorter for younger kids (attention span). ADHD-friendly: never long.
  if (age !== undefined && age <= 6) return 3;
  return 5;
}

/** System prompt shared by question generation and answer evaluation. */
function quizSystemPrompt(age?: number, easyMode?: boolean): string {
  const ageLine = age ? ` The child is ${age} years old.` : "";
  return (
    `You are a kind quiz host for children in a family app.${ageLine}\n\n` +
    "DESIGN FOR ADHD AND AUTISTIC KIDS:\n" +
    "- Use short, literal sentences. No idioms, no trick questions, no ambiguity.\n" +
    "- One fact per question. Keep questions under 15 words.\n" +
    (easyMode
      ? "- ALWAYS give 3 multiple-choice options. The child picks one.\n"
      : "- Give 3 multiple-choice options UNLESS the question is very simple.\n") +
    "- Choices must be real words or phrases, never just \"A\", \"B\", \"C\".\n" +
    "- Never shame a wrong answer. Say \"Good try!\" then give the correct answer as a fact.\n" +
    "- Never use the word \"wrong\". Never count down or rush.\n" +
    "- Keep it fun and factual. One short fun fact is welcome after the answer.\n\n" +
    "Respond with ONLY the JSON object, no other text."
  );
}

export function buildQuizStartMessages(topic: string, age: number | undefined, easyMode: boolean): Array<{ role: string; content: string }> {
  const total = questionCount(age);
  return [
    { role: "system", content: quizSystemPrompt(age, easyMode) },
    {
      role: "user",
      content:
        `Start a ${total}-question quiz about "${topic}".\n\n` +
        `JSON format:\n` +
        `{"question": "the question text", "choices": ["option A", "option B", "option C"], ` +
        `"spoken": "Question 1 of ${total}. <question> Is it <A>, <B>, or <C>?"}`,
    },
  ];
}

export function buildQuizAnswerMessages(
  topic: string,
  age: number | undefined,
  easyMode: boolean,
  history: QuizTurn[],
  answer: string,
): Array<{ role: string; content: string }> {
  const total = questionCount(age);
  const doneCount = history.length;
  const correctCount = history.filter((h) => h.correct).length;
  const lastQ = history[history.length - 1];
  const asked = history
    .map((h) => `- Q: ${h.question} | kid answered: ${h.userAnswer ?? "?"} (${h.correct ? "correct" : "not quite"})`)
    .join("\n");

  return [
    { role: "system", content: quizSystemPrompt(age, easyMode) },
    {
      role: "user",
      content:
        `Quiz topic: "${topic}". ${total} questions total, ${doneCount} asked so far, ` +
        `${correctCount} correct.\n\n` +
        `Previous questions (do not repeat):\n${asked || "(none)"}\n\n` +
        `Last question: "${lastQ?.question ?? ""}"\n` +
        `The child answered: "${answer}"\n\n` +
        "Evaluate gently: accept close answers and mishearings " +
        `(e.g. \"tea rex\" means \"T. rex\"). If the child says \"stop\", \"quit\", \"done\", or \"easier\", ` +
        `set stopRequested or easyRequested accordingly.\n\n` +
        `JSON format:\n` +
        `{"correct": true/false, "feedback": "short kind spoken feedback", ` +
        `"stopRequested": false, "easyRequested": false, ` +
        `"next": {"question": "...", "choices": ["A", "B", "C"], "spoken": "Question ${doneCount + 1} of ${total}. ..."} or null if quiz is over, ` +
        `"done": false}`,
    },
  ];
}

export interface ParsedQuizStart {
  question: string;
  choices?: string[];
  spoken: string;
}

export function parseQuizStart(raw: string): ParsedQuizStart | null {
  const obj = extractJson(raw);
  if (!obj || typeof obj.question !== "string" || !obj.question.trim()) return null;
  const out: ParsedQuizStart = {
    question: obj.question.trim().slice(0, 300),
    spoken: typeof obj.spoken === "string" && obj.spoken.trim()
      ? obj.spoken.trim().slice(0, 400)
      : obj.question.trim().slice(0, 300),
  };
  if (Array.isArray(obj.choices)) {
    const choices = obj.choices.filter((c: unknown): c is string => typeof c === "string" && c.trim()).map((c: string) => c.trim().slice(0, 60)).slice(0, 4);
    if (choices.length >= 2) out.choices = choices;
  }
  return out;
}

export interface ParsedQuizAnswer {
  correct: boolean;
  feedback: string;
  stopRequested: boolean;
  easyRequested: boolean;
  next: ParsedQuizStart | null;
  done: boolean;
}

export function parseQuizAnswer(raw: string): ParsedQuizAnswer | null {
  const obj = extractJson(raw);
  if (!obj || typeof obj.feedback !== "string") return null;
  let next: ParsedQuizStart | null = null;
  if (obj.next && typeof obj.next === "object" && typeof obj.next.question === "string") {
    next = parseQuizStart(JSON.stringify(obj.next));
  }
  return {
    correct: obj.correct === true,
    feedback: obj.feedback.slice(0, 300),
    stopRequested: obj.stopRequested === true,
    easyRequested: obj.easyRequested === true,
    next,
    done: obj.done === true || next === null,
  };
}

function extractJson(raw: string): Record<string, any> | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
