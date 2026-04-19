import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const BodySchema = z.object({
  tag: z.string(),
  sessionId: z.string().optional(),
  at: z.number().optional(),
  data: z.record(z.string(), z.any()).optional(),
});

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json().catch(() => ({})));
    // Intentionally log for debugging. In production, replace with structured logging.
    console.log("[client-event]", {
      tag: body.tag,
      sessionId: body.sessionId,
      at: body.at ?? Date.now(),
      data: body.data ?? {},
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Bad request" },
      { status: 400 },
    );
  }
}

