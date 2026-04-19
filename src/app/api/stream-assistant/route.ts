import { NextResponse } from "next/server";
import { z } from "zod";
import { INTERVIEWER_PERSONA, buildAssistantMessagePrompt } from "@/lib/prompts";
import { appendTurn, endSession, getSession } from "@/lib/sessionStore";
import { groqChatStream } from "@/lib/groq";

export const runtime = "nodejs";

const BodySchema = z.object({
  sessionId: z.string(),
  userText: z.string(),
  action: z.enum(["followup", "next", "end"]),
  nextPrompt: z.string(),
});

function sseLine(data: string) {
  return `data: ${data}\n\n`;
}

type GroqStreamChunk = {
  choices?: Array<{
    delta?: { content?: string };
    message?: { content?: string };
  }>;
};

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const state = getSession(body.sessionId);
    if (!state) {
      return NextResponse.json(
        { error: "NO_SESSION", message: "Session expired or not found." },
        { status: 401 },
      );
    }

    // Stream a natural assistant message that includes nextPrompt verbatim.
    const upstream = await groqChatStream({
      model: process.env.GROQ_MODEL_INTERVIEW ?? "llama-3.3-70b-versatile",
      temperature: 0.5,
      messages: [
        { role: "system", content: INTERVIEWER_PERSONA },
        {
          role: "user",
          content: buildAssistantMessagePrompt({
            userText: body.userText,
            nextPrompt: body.nextPrompt,
            action: body.action,
          }),
        },
      ],
    });

    const encoder = new TextEncoder();
    let fullText = "";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(sseLine(JSON.stringify({ type: "start" }))));

        const reader = upstream.body?.getReader();
        if (!reader) {
          controller.enqueue(
            encoder.encode(sseLine(JSON.stringify({ type: "error", message: "No upstream body" }))),
          );
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let carry = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            carry += decoder.decode(value, { stream: true });

            // Parse SSE from Groq (OpenAI-compatible): lines starting with "data: "
            const parts = carry.split("\n");
            carry = parts.pop() ?? "";

            for (const line of parts) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice("data:".length).trim();
              if (!payload) continue;
              if (payload === "[DONE]") continue;

              let json: GroqStreamChunk | null = null;
              try {
                json = JSON.parse(payload) as GroqStreamChunk;
              } catch {
                continue;
              }

              const delta: string | undefined =
                json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.message?.content;
              if (!delta) continue;

              fullText += delta;
              controller.enqueue(
                encoder.encode(sseLine(JSON.stringify({ type: "delta", text: delta }))),
              );
            }
          }
        } catch (e: unknown) {
          controller.enqueue(
            encoder.encode(
              sseLine(
                JSON.stringify({
                  type: "error",
                  message: e instanceof Error ? e.message : "Stream error",
                }),
              ),
            ),
          );
        } finally {
          // Persist assistant turn once streaming is done
          const assistantText = fullText.trim();
          if (assistantText) {
            appendTurn(body.sessionId, { role: "assistant", text: assistantText });
          }
          if (body.action === "end") endSession(body.sessionId);

          controller.enqueue(encoder.encode(sseLine(JSON.stringify({ type: "done" }))));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "STREAM_FAILED", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

