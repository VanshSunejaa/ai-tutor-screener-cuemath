import { NextResponse } from "next/server";
import { z } from "zod";
import type { EvaluationReport } from "@/lib/types";
import { buildEvaluationPrompt, INTERVIEWER_PERSONA } from "@/lib/prompts";
import { getSession } from "@/lib/sessionStore";
import { groqChatJson } from "@/lib/groq";

export const runtime = "nodejs";

const BodySchema = z.object({
  sessionId: z.string().optional(),
});

function getCookieSessionId(req: Request) {
  return req.headers
    .get("cookie")
    ?.split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith("ai_tutor_session="))
    ?.split("=")[1];
}

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json().catch(() => ({})));
    const sessionId = body.sessionId ?? getCookieSessionId(req) ?? undefined;
    const state = getSession(sessionId);
    if (!state) {
      return NextResponse.json(
        { error: "NO_SESSION", message: "Session expired or not found." },
        { status: 401 },
      );
    }

    const transcript = state.transcript;
    if (transcript.length < 2) {
      return NextResponse.json(
        { error: "NO_TRANSCRIPT", message: "Not enough transcript to evaluate." },
        { status: 400 },
      );
    }

    const report = await groqChatJson<EvaluationReport>({
      model: process.env.GROQ_MODEL_EVAL ?? process.env.GROQ_MODEL_INTERVIEW ?? "llama-3.3-70b-versatile",
      temperature: 0.2,
      messages: [
        { role: "system", content: INTERVIEWER_PERSONA },
        { role: "user", content: buildEvaluationPrompt(transcript) },
      ],
    });

    // Defensive normalization
    const keys = ["clarity", "simplicity", "patience", "warmth", "fluency"] as const;
    const rawScores = report.scores ?? ({} as EvaluationReport["scores"]);
    const normalizedScores = {} as EvaluationReport["scores"];
    for (const k of keys) {
      const v = Number(rawScores[k]);
      normalizedScores[k] = Number.isFinite(v) ? Math.max(1, Math.min(10, Math.round(v))) : 5;
    }
    report.scores = normalizedScores;
    report.strengths = Array.isArray(report.strengths) ? report.strengths : [];
    report.improvements = Array.isArray(report.improvements) ? report.improvements : [];
    report.evidence = Array.isArray(report.evidence) ? report.evidence : [];
    report.ideal_answers = Array.isArray(report.ideal_answers) ? report.ideal_answers : [];
    report.final_decision = report.final_decision === "PASS" ? "PASS" : "REJECT";
    report.transcript = transcript;

    return NextResponse.json(report);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "REPORT_FAILED", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

