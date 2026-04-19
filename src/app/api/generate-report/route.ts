import { NextResponse } from "next/server";
import { z } from "zod";
import type { EvaluationReport } from "@/lib/types";
import { buildEvaluationPrompt, INTERVIEWER_PERSONA } from "@/lib/prompts";
import { groqChatJson } from "@/lib/groq";

export const runtime = "nodejs";

const BodySchema = z.object({
  transcript: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      text: z.string(),
    })
  ).optional(),
});

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json().catch(() => ({})));
    const transcript = body.transcript;

    if (!transcript || transcript.length < 2) {
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
        { role: "user", content: buildEvaluationPrompt(transcript as any) }, // cast to bypass strictly typed 'at' field
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
    report.transcript = transcript as any;

    return NextResponse.json(report);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "REPORT_FAILED", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
