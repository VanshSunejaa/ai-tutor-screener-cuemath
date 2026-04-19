import { NextResponse } from "next/server";
import { z } from "zod";
import { INTERVIEWER_PERSONA, buildTurnPrompt } from "@/lib/prompts";
import { appendTurn, endSession, getSession, setState } from "@/lib/sessionStore";
import { groqChatJson, groqTranscribe } from "@/lib/groq";

export const runtime = "nodejs";

const QuerySchema = z.object({
  sessionId: z.string().optional(),
});

type TurnJson = {
  action: "followup" | "next" | "end";
  nextPrompt: string;
  assistantText: string;
  reason: string;
  flags: {
    vague: boolean;
    tooComplex: boolean;
    lowEmpathy: boolean;
    offTopic: boolean;
    strong: boolean;
    tooShort: boolean;
    tooLong: boolean;
  };
};

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
    const t0 = Date.now();
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

    const sttStart = Date.now();
    const userText = await groqTranscribe({ file: audioFile, language: "en" });
    const sttMs = Date.now() - sttStart;
    if (looksLikeSilenceOrJunk(userText)) {
      return NextResponse.json({
        ok: true,
        action: "retry",
        transcriptedText: userText,
        message:
          "I didn’t quite catch that—could you try again? Take your time and speak a bit closer to the mic.",
        timings: { sttMs, llmMs: 0, totalMs: Date.now() - t0 },
      });
    }

    appendTurn(state.sessionId, { role: "user", text: userText });

    const currentQuestion = state.questions[state.currentQuestionIndex] ?? "";
    const recentTranscript = state.transcript.slice(-12);

    const llmStart = Date.now();
    const turn = await groqChatJson<TurnJson>({
      model: process.env.GROQ_MODEL_INTERVIEW ?? "llama-3.1-8b-instant",
      temperature: 0.3,
      messages: [
        { role: "system", content: INTERVIEWER_PERSONA },
        {
          role: "user",
          content: buildTurnPrompt({
            state,
            userText,
            currentQuestion,
            recentTranscript,
          }),
        },
      ],
    });
    const llmMs = Date.now() - llmStart;

    // Apply guardrails and compute the actual next prompt.
    let action: TurnJson["action"] = turn.action;
    let nextPrompt = (turn.nextPrompt ?? "").trim();
    let assistantText = (turn.assistantText ?? "").trim();

    if (state.followUpCount >= state.maxFollowUpsPerQuestion && action === "followup") {
      action = "next";
    }

    if (action === "followup") {
      if (!nextPrompt) {
        // Fallback follow-up
        nextPrompt = "Could you walk me through a concrete example of how you’d do that?";
      }
      setState(state.sessionId, { followUpCount: state.followUpCount + 1 });
    }

    if (action === "next") {
      const nextIndex = state.currentQuestionIndex + 1;
      if (nextIndex >= state.questions.length) {
        action = "end";
      } else {
        nextPrompt = state.questions[nextIndex]!;
        setState(state.sessionId, { currentQuestionIndex: nextIndex, followUpCount: 0 });
      }
    }

    if (action === "end") {
      nextPrompt = "";
      assistantText =
        assistantText ||
        "That was really helpful—thank you. I’m going to take a moment to review everything and put together your feedback.";
      endSession(state.sessionId);
    }

    if (!assistantText) {
      // Safe fallback if model returns empty assistantText
      assistantText =
        action === "end"
          ? "Thanks—really appreciate your time. I’m going to review everything and generate your feedback now."
          : `Got it—thank you.\n\n${nextPrompt}`;
    }

    appendTurn(state.sessionId, { role: "assistant", text: assistantText });

    return NextResponse.json({
      ok: true,
      transcriptedText: userText,
      assistantText,
      decision: { action, nextPrompt, reason: turn.reason, flags: turn.flags },
      state: {
        currentQuestionIndex: getSession(state.sessionId)?.currentQuestionIndex ?? 0,
        followUpCount: getSession(state.sessionId)?.followUpCount ?? 0,
        done: getSession(state.sessionId)?.done ?? false,
      },
      timings: { sttMs, llmMs, totalMs: Date.now() - t0 },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "UTTERANCE_FAILED", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

