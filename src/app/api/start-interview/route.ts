import { NextResponse } from "next/server";
import { z } from "zod";
import { getBaseQuestions } from "@/lib/prompts";
import { appendTurn, createSession } from "@/lib/sessionStore";
import { groqChatJson } from "@/lib/groq";

export const runtime = "nodejs";

const BodySchema = z
  .object({
    locale: z.string().optional(),
    targetClass: z.string().optional(),
  })
  .optional();

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json().catch(() => undefined));
    const targetClass = body?.targetClass;

    let questions: string[];
    if (targetClass) {
      try {
        const resp = await groqChatJson<{ questions: string[] }>({
          model: process.env.GROQ_MODEL_INTERVIEW ?? "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: `You are an expert Math curriculum designer. Generate exactly 5 interview questions for a tutor who will teach math to a student from ${targetClass}. 
Output STRICT JSON with this shape: { "questions": [ "q1", "q2", "q3", "q4", "q5" ] }

Rules for Questions:
- Q1: Brief introduction and teaching experience.
- Q2: Ask them to explain a specific core math concept appropriate for ${targetClass} using a real-life example.
- Q3: A pedagogical scenario (e.g. student shuts down or gets stuck on a specific ${targetClass} topic).
- Q4: A question on structuring a 30-minute tutoring session for this age group.
- Q5: A question on assessing student retention for a ${targetClass} concept.
Keep questions concise and conversational.`
            }
          ]
        });
        questions = resp.questions;
      } catch (e) {
        console.error("Failed to generate dynamic questions", e);
        questions = getBaseQuestions(targetClass);
      }
    } else {
      questions = getBaseQuestions(targetClass);
    }

    const state = createSession(questions, targetClass);

    const greeting =
      "Hi! I'm Simran, and I’ll be your interviewer today. Let’s start with a quick introduction.";

    const firstQuestion = state.questions[0]!;
    const assistantText = `${greeting}\n\n${firstQuestion}`;

    appendTurn(state.sessionId, { role: "assistant", text: greeting });
    appendTurn(state.sessionId, { role: "assistant", text: firstQuestion });

    const res = NextResponse.json({
      sessionId: state.sessionId,
      assistantText,
      locale: body?.locale ?? "en",
    });
    res.cookies.set("ai_tutor_session", state.sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60,
    });
    return res;
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "START_FAILED", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

