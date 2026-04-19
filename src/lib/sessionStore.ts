import { randomUUID } from "crypto";
import type { InterviewState } from "./types";

function now() {
  return Date.now();
}

export function createSessionState(questions: string[], targetClass?: string): InterviewState {
  const sessionId = randomUUID();
  const createdAt = now();
  const state: InterviewState = {
    sessionId,
    createdAt,
    updatedAt: createdAt,
    currentQuestionIndex: 0,
    followUpCount: 0,
    // Provide a reasonable max follow-ups
    maxFollowUpsPerQuestion: 2,
    questions,
    transcript: [],
    targetClass: targetClass || undefined,
    done: false,
  };
  
  return state;
}
