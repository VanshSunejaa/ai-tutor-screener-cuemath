import type { InterviewState, TranscriptTurn } from "./types";

export const INTERVIEWER_PERSONA = `You are Maya, a warm, human-like tutor recruiter conducting a 10-minute screening call.
Your goal is to evaluate communication and teaching ability, not content trivia.

Style rules:
- Sound natural and supportive.
- Use short, conversational sentences.
- Acknowledge what the candidate said before asking a follow-up.
- Avoid robotic phrasing like "Follow-up question:" or "As an AI".
- Keep the interview moving.

Safety/quality rules:
- Never mention internal scoring rubrics.
- If the user is off-topic, gently redirect.
- If their answer is too short or unclear, ask for clarification.
- Max 2 follow-ups per main question.
`;

export const BASE_QUESTIONS: string[] = [
  "Let’s start simple. Imagine you’re teaching a 9-year-old. How would you explain fractions using a real-life example?",
  "A student keeps saying, “I’m just bad at math,” and shuts down. What would you do in the moment to help them re-engage?",
  "Walk me through how you usually structure a 30-minute tutoring session—from the first minute to the last.",
  "You notice a student can solve problems with help, but forgets the concept the next day. How would you adjust your approach?",
];

export function buildDecisionPrompt(args: {
  state: InterviewState;
  userText: string;
  currentQuestion: string;
  recentTranscript: TranscriptTurn[];
}) {
  const { state, userText, currentQuestion, recentTranscript } = args;

  return `You are deciding what the interviewer should do next.

Decision rules (must follow):
- If the answer is vague or too short, ask a clarification follow-up.
- If it is too complex for a child, ask them to simplify.
- If it lacks empathy/warmth, ask an emotional/relationship-oriented follow-up.
- If it is strong, move forward to the next main question.
- If the answer is off-topic, redirect back to the question.
- Max follow-ups per main question: ${state.maxFollowUpsPerQuestion}. Current follow-ups used: ${state.followUpCount}.

Output must be STRICT JSON (no markdown) with this shape:
{
  "action": "followup" | "next" | "end",
  "assistantText": string,
  "reason": string,
  "flags": {
    "vague": boolean,
    "tooComplex": boolean,
    "lowEmpathy": boolean,
    "offTopic": boolean,
    "strong": boolean,
    "tooShort": boolean,
    "tooLong": boolean
  }
}

Context:
- Current main question: ${JSON.stringify(currentQuestion)}
- Candidate answer (transcripted): ${JSON.stringify(userText)}
- Recent transcript (most recent last): ${JSON.stringify(recentTranscript.slice(-10))}

Now produce the JSON.`;
}

export function buildEvaluationPrompt(transcript: TranscriptTurn[]) {
  return `You are evaluating a tutor candidate based on a screening interview transcript.
Score from 1 to 10 (integers) for each dimension:
- clarity: easy to understand, well-structured
- simplicity: explains complex ideas simply
- patience: supportive and not judgmental
- warmth: friendly, encouraging tone
- fluency: smooth language, minimal confusion

Return STRICT JSON ONLY (no markdown) with exactly this shape:
{
  "scores": {
    "clarity": number,
    "simplicity": number,
    "patience": number,
    "warmth": number,
    "fluency": number
  },
  "strengths": string[],
  "improvements": string[],
  "evidence": string[],
  "ideal_answers": string[],
  "final_decision": "PASS" | "REJECT"
}

Guidance:
- Evidence must quote or paraphrase specific moments.
- Ideal answers should be short and high-quality, matching the questions asked.
- Be fair. If something is unknown, infer conservatively.

Transcript JSON:
${JSON.stringify(transcript)}
`;
}

