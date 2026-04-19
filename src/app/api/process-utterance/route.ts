import { NextResponse } from "next/server";
import { INTERVIEWER_PERSONA, buildTurnPrompt } from "@/lib/prompts";
import { groqChatJson, groqTranscribe } from "@/lib/groq";
import type { InterviewState } from "@/lib/types";

export const runtime = "nodejs";

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
    const form = await req.formData();
    const audioFile = form.get("audio");
    
    // Completely stateless: read the fully passed state from the client
    const stateStr = form.get("state");
    if (!stateStr || typeof stateStr !== "string") {
      return NextResponse.json(
        { error: "NO_STATE", message: "Client did not provide state payload." },
        { status: 400 },
      );
    }
    
    // Parse the state
    const state: InterviewState = JSON.parse(stateStr);

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
        state // Return unchanged state for retries
      });
    }

    // Append user input
    state.transcript.push({ role: "user", text: userText, at: Date.now() });

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
      state.followUpCount += 1;
    }

    if (action === "next") {
      const nextIndex = state.currentQuestionIndex + 1;
      if (nextIndex >= state.questions.length) {
        action = "end";
      } else {
        nextPrompt = state.questions[nextIndex]!;
        state.currentQuestionIndex = nextIndex;
        state.followUpCount = 0;
      }
    }

    if (action === "end") {
      nextPrompt = "";
      assistantText =
        assistantText ||
        "That was really helpful—thank you. I’m going to take a moment to review everything and put together your feedback.";
      state.done = true;
    }

    if (!assistantText) {
      // Safe fallback if model returns empty assistantText
      assistantText =
        action === "end"
          ? "Thanks—really appreciate your time. I’m going to review everything and generate your feedback now."
          : `Got it—thank you.\n\n${nextPrompt}`;
    }

    state.transcript.push({ role: "assistant", text: assistantText, at: Date.now() });
    state.updatedAt = Date.now();

    return NextResponse.json({
      ok: true,
      transcriptedText: userText,
      assistantText,
      decision: { action, nextPrompt, reason: turn.reason, flags: turn.flags },
      state, // Return mutated state so frontend can overwrite its copy
      timings: { sttMs, llmMs, totalMs: Date.now() - t0 },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "UTTERANCE_FAILED", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
