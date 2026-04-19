import { NextResponse } from "next/server";
import { z } from "zod";
import type { InterviewStepResult } from "@/lib/types";
import { INTERVIEWER_PERSONA, buildDecisionPrompt } from "@/lib/prompts";
import { appendTurn, endSession, getSession, setState } from "@/lib/sessionStore";
import { groqChatJson, groqTranscribe } from "@/lib/groq";

export const runtime = "nodejs";

const QuerySchema = z.object({
  sessionId: z.string().optional(),
});

function getSessionId(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  return parsed.success ? parsed.data.sessionId : undefined;
}

function looksLikeSilenceOrJunk(text: string) {
  const t = text.trim();
  if (!t) return true;
  if (t.length < 5) return true;
  const normalized = t.toLowerCase();
  if (["um", "uh", "hmm", "mm", "…", "..."].includes(normalized)) return true;
  return false;
}

export async function POST(req: Request) {
  try {
    const urlSessionId = getSessionId(req);
    const cookieSessionId = req.headers
      .get("cookie")
      ?.split(";")
      .map((p) => p.trim())
      .find((p) => p.startsWith("ai_tutor_session="))
      ?.split("=")[1];

    const sessionId = urlSessionId ?? cookieSessionId ?? undefined;
    const state = getSession(sessionId);
    if (!state) {
      return NextResponse.json(
        { error: "NO_SESSION", message: "Session expired or not found." },
        { status: 401 },
      );
    }

    const form = await req.formData();
    const audioFile = form.get("audio");
    if (!(audioFile instanceof File)) {
      return NextResponse.json(
        { error: "NO_AUDIO", message: "No audio uploaded." },
        { status: 400 },
      );
    }

    const userText = await groqTranscribe({ file: audioFile, language: "en" });

    if (looksLikeSilenceOrJunk(userText)) {
      const assistantText =
        "I didn’t quite catch that—could you try answering again? " +
        "Take your time, and speak a little closer to the mic.";
      appendTurn(state.sessionId, { role: "assistant", text: assistantText });
      return NextResponse.json({
        action: "retry",
        transcriptedText: userText,
        assistantText,
      });
    }

    appendTurn(state.sessionId, { role: "user", text: userText });

    const currentQuestion = state.questions[state.currentQuestionIndex] ?? "";
    const recentTranscript = state.transcript.slice(-12);

    type Decision = Exclude<InterviewStepResult, { action: "retry" }>;
    let decision = await groqChatJson<Decision>({
      model: process.env.GROQ_MODEL_INTERVIEW ?? "llama-3.3-70b-versatile",
      temperature: 0.4,
      messages: [
        { role: "system", content: INTERVIEWER_PERSONA },
        {
          role: "user",
          content: buildDecisionPrompt({
            state,
            userText,
            currentQuestion,
            recentTranscript,
          }),
        },
      ],
    });

    // Hard constraints / guardrails
    if (state.followUpCount >= state.maxFollowUpsPerQuestion && decision.action === "followup") {
      decision = {
        ...decision,
        action: "next",
        reason: "Max follow-ups reached; moving to next main question.",
      };
    }

    // Force follow-up if too short and we still can
    if (
      "flags" in decision &&
      decision.flags.tooShort === true &&
      state.followUpCount < state.maxFollowUpsPerQuestion &&
      decision.action === "next"
    ) {
      decision = {
        ...decision,
        action: "followup",
        assistantText:
          "Thanks—could you add a bit more detail? A specific example would help me understand your approach.",
        reason: "Answer too short; asking for more detail.",
      };
    }

    if (decision.action === "next") {
      const nextIndex = state.currentQuestionIndex + 1;
      if (nextIndex >= state.questions.length) {
        decision = {
          ...decision,
          action: "end",
          assistantText:
            "That was really helpful—thank you. I’m going to take a moment to review everything and put together your feedback.",
          reason: "Reached end of question set.",
        };
      } else {
        const nextQuestion = state.questions[nextIndex]!;
        const assistantText =
          (decision.assistantText?.trim()
            ? decision.assistantText.trim() + "\n\n"
            : "Got it—thanks.\n\n") + nextQuestion;
        decision = { ...decision, assistantText, action: "next" };
        setState(state.sessionId, {
          currentQuestionIndex: nextIndex,
          followUpCount: 0,
        });
      }
    } else if (decision.action === "followup") {
      setState(state.sessionId, { followUpCount: state.followUpCount + 1 });
    } else if (decision.action === "end") {
      endSession(state.sessionId);
    }

    const assistantText = decision.assistantText;
    appendTurn(state.sessionId, { role: "assistant", text: assistantText });

    return NextResponse.json({
      ...decision,
      transcriptedText: userText,
      state: {
        currentQuestionIndex: getSession(state.sessionId)?.currentQuestionIndex ?? 0,
        followUpCount: getSession(state.sessionId)?.followUpCount ?? 0,
        done: getSession(state.sessionId)?.done ?? false,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "PROCESS_FAILED", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

