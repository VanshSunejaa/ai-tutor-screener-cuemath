import { randomUUID } from "crypto";
import type { InterviewState, TranscriptTurn } from "./types";

const SESSION_TTL_MS = 1000 * 60 * 60; // 1 hour

type Store = Map<string, InterviewState>;

declare global {
  var __AI_TUTOR_SCREENER_STORE__: Store | undefined;
}

function getStore(): Store {
  if (!global.__AI_TUTOR_SCREENER_STORE__) {
    global.__AI_TUTOR_SCREENER_STORE__ = new Map();
  }
  return global.__AI_TUTOR_SCREENER_STORE__;
}

function now() {
  return Date.now();
}

export function createSession(questions: string[], targetClass?: string): InterviewState {
  const sessionId = randomUUID();
  const createdAt = now();
  const state: InterviewState = {
    sessionId,
    createdAt,
    updatedAt: createdAt,
    currentQuestionIndex: 0,
    followUpCount: 0,
    maxFollowUpsPerQuestion: 2,
    questions,
    transcript: [],
    targetClass,
    done: false,
  };
  getStore().set(sessionId, state);
  return state;
}

export function getSession(sessionId: string | undefined | null): InterviewState | null {
  if (!sessionId) return null;
  const s = getStore().get(sessionId);
  if (!s) return null;
  if (now() - s.updatedAt > SESSION_TTL_MS) {
    getStore().delete(sessionId);
    return null;
  }
  return s;
}

export function touchSession(sessionId: string) {
  const s = getStore().get(sessionId);
  if (!s) return;
  s.updatedAt = now();
}

export function appendTurn(sessionId: string, turn: Omit<TranscriptTurn, "at"> & { at?: number }) {
  const s = getStore().get(sessionId);
  if (!s) return;
  s.transcript.push({ ...turn, at: turn.at ?? now() } as TranscriptTurn);
  s.updatedAt = now();
}

export function setState(sessionId: string, patch: Partial<InterviewState>) {
  const s = getStore().get(sessionId);
  if (!s) return;
  Object.assign(s, patch);
  s.updatedAt = now();
}

export function endSession(sessionId: string) {
  const s = getStore().get(sessionId);
  if (!s) return;
  s.done = true;
  s.updatedAt = now();
}

